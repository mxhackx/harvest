"use client";

import { ROUTES } from "@/lib/routes";
import { cssVar } from "@/lib/theme";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, describeError, type Lead } from "@/lib/api";
import { stageOf } from "@/lib/stages";
import { useStages } from "@/lib/stages-store";
import { routeLine } from "@/lib/route";
import { leadsOfTheDay } from "@/lib/today";
import { useSession } from "@/lib/session";
import { ExpandIcon, ShrinkIcon } from "./icons";
import { LeadSummary } from "./lead-summary";
import { Notice } from "./ui";

/** « all » ou la clé d'une étape */
type Filter = string;
type Located = Lead & { lat: number; lng: number };

const DEFAULT_CENTER: [number, number] = [2.42, 6.37];

const isLocated = (l: Lead): l is Located => l.lat !== null && l.lng !== null;
const isVisited = (l: Lead) => l.visitedAt !== null;

const empty = { type: "FeatureCollection", features: [] } as const;

type Scope = "today" | "all";

export function LeadMap({
  leads,
  todayIds,
  onChanged,
  onOpen,
}: {
  leads: Lead[];
  /** Leads qui ont un rendez-vous aujourd'hui. */
  todayIds: ReadonlySet<string>;
  onChanged: () => void;
  onOpen?: (lead: Lead) => void;
}) {
  const { companyId } = useSession();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  // Par défaut la carte montre la tournée du jour ; « Tous les leads » les affiche tous.
  const [scope, setScope] = useState<Scope>("today");
  const [showRoute, setShowRoute] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);

  const { stages } = useStages();
  const todayLeads = useMemo(() => leadsOfTheDay(leads, todayIds), [leads, todayIds]);
  const scoped = scope === "today" ? todayLeads : leads;
  const located = useMemo(() => scoped.filter(isLocated), [scoped]);
  const locatedToday = useMemo(() => todayLeads.filter(isLocated).length, [todayLeads]);
  const locatedAll = useMemo(() => leads.filter(isLocated).length, [leads]);
  // « Toutes étapes » laisse de côté les leads perdus : on ne va pas les visiter. Le filtre « Perdu » les montre.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const l of located) {
      c[l.status] = (c[l.status] ?? 0) + 1;
      if (stageOf(stages, l.status).kind !== "lost") c.all++;
    }
    return c;
  }, [located, stages]);
  const visible = useMemo(
    () => located.filter((l) => (filter === "all" ? stageOf(stages, l.status).kind !== "lost" : l.status === filter)),
    [located, filter, stages],
  );
  const selected = visible.find((l) => l.id === selectedId) ?? null;

  // --- création de la carte, une seule fois ---
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new maplibregl.Map({
        container: container.current,
        center: DEFAULT_CENTER,
        zoom: 11,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: "© contributeurs OpenStreetMap",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });
      map = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      m.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), "bottom-left");
      m.on("load", () => {
        m.addSource("route", { type: "geojson", data: empty as never });
        m.addSource("leads", { type: "geojson", data: empty as never });
        // liseré blanc sous la ligne : elle reste lisible sur les rues orange et jaunes du fond de carte
        m.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.85 },
        });
        m.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": cssVar("--color-route"), "line-width": 3, "line-opacity": 1 },
        });
        // anneau autour du lead sélectionné
        m.addLayer({
          id: "leads-selected",
          type: "circle",
          source: "leads",
          filter: ["==", ["get", "id"], ""],
          paint: { "circle-radius": 11, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": cssVar("--color-ink"), "circle-stroke-width": 1.5 },
        });
        // petits points : un par lead, dès sa création
        m.addLayer({
          id: "leads-circle",
          type: "circle",
          source: "leads",
          paint: { "circle-radius": 6, // la couleur vient de l'étape du lead (propriété `color` de chaque point)
            "circle-color": ["to-color", ["get", "color"]] as never, "circle-stroke-color": cssVar("--color-page"), "circle-stroke-width": 1.5 },
        });
        m.on("mouseenter", "leads-circle", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "leads-circle", () => (m.getCanvas().style.cursor = ""));
        m.on("click", (e) => {
          // marge de 6 px autour du point : cible confortable malgré sa petite taille
          const box: [[number, number], [number, number]] = [
            [e.point.x - 6, e.point.y - 6],
            [e.point.x + 6, e.point.y + 6],
          ];
          const hit = m.queryRenderedFeatures(box, { layers: ["leads-circle"] })[0];
          setSelectedId(hit ? String(hit.properties?.id) : null);
        });
        mapRef.current = m;
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current = null;
      setReady(false);
      map?.remove();
    };
  }, []);

  // --- données de la carte : suit les leads en temps réel ---
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("leads") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: visible.map((l) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [l.lng, l.lat] },
        properties: { id: l.id, status: l.status, name: l.name, color: stageOf(stages, l.status).color },
      })),
    });
    // la ligne relie tous les points affichés (elle suit donc le filtre d'étape choisi)
    const line = showRoute ? routeLine(visible) : [];
    (map.getSource("route") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: line.length > 1 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: line }, properties: {} }] : [],
    });
  }, [ready, visible, showRoute, stages]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) map.setFilter("leads-selected", ["==", ["get", "id"], selected?.id ?? ""]);
  }, [ready, selected]);

  // --- cadrage : à la première arrivée de points, puis au changement de filtre ---
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || visible.length === 0) return;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (visible.length === 1) {
        map.flyTo({ center: [visible[0].lng, visible[0].lat], zoom: 14, duration: fitted.current ? 600 : 0 });
      } else {
        const b = new maplibregl.LngLatBounds();
        visible.forEach((l) => b.extend([l.lng, l.lat]));
        map.fitBounds(b, { padding: 80, maxZoom: 15, duration: fitted.current ? 600 : 0 });
      }
      fitted.current = true;
    })();
    // on recadre quand l'ensemble de points visibles change, pas à chaque rafraîchissement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filter, visible.map((l) => l.id).join(",")]);

  // --- la bulle suit son repère quand on déplace ou zoome la carte ---
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selected) {
      setAnchor(null);
      return;
    }
    const update = () => {
      const p = map.project([selected.lng, selected.lat]);
      setAnchor({ x: p.x, y: p.y });
    };
    // On place le repère dans le tiers bas pour que la bulle, au-dessus, ait toujours la place.
    const h = map.getContainer().clientHeight;
    map.easeTo({ center: [selected.lng, selected.lat], offset: [0, h * 0.2], duration: 350 });
    update();
    map.on("move", update);
    return () => {
      map.off("move", update);
    };
  }, [ready, selected]);

  // La carte change de taille : MapLibre doit recalculer son canevas.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const frame = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(frame);
  }, [expanded, ready]);

  // Plein écran : Échap referme, la page derrière ne défile plus, le focus revient sur le bouton.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const button = toggleButton.current;
    button?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      button?.focus();
    };
  }, [expanded]);

  async function placeMissing() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ queued: number; geocoding: boolean }>("/leads/locate-missing", { method: "POST", body: {}, companyId });
      setInfo(
        r.queued === 0
          ? "Ces leads n'ont ni adresse ni lien Google Maps : ouvrez leur fiche pour les placer."
          : r.geocoding
            ? `Recherche de position lancée pour ${r.queued} ${r.queued > 1 ? "leads" : "lead"} : ils apparaissent sur la carte dans quelques instants.`
            : "La recherche d'adresse est désactivée : collez un lien Google Maps ou placez les leads depuis leur fiche.",
      );
      // la recherche se fait en arrière-plan, un lead à la fois : on revient voir le résultat
      setTimeout(onChanged, 6000);
      setTimeout(onChanged, 20000);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisited(lead: Lead) {
    setBusy(true);
    setError(null);
    try {
      await api(`/leads/${lead.id}`, { method: "PATCH", body: { visited: !isVisited(lead) }, companyId });
      onChanged();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const flip = anchor !== null && anchor.y < 280; // vraiment pas de place au-dessus : la bulle passe dessous
  const unplaced = scoped.length - located.length;

  return (
    // le cadre extérieur garde sa hauteur : la page ne saute pas quand la carte passe en plein écran
    <div className="relative h-[460px] md:h-[560px]">
    <div
      className={expanded ? "fixed inset-0 z-40 bg-card" : "absolute inset-0 overflow-hidden"}
      {...(expanded ? { role: "dialog", "aria-modal": true, "aria-label": "Carte de tournée en grand" } : {})}
    >
      {/* MapLibre impose position:relative à son conteneur : on lui donne donc une taille explicite dans un cadre absolu */}
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>

      {/* en haut à gauche : le périmètre (jour / tous), puis les filtres d'étape qui servent aussi de légende */}
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2 pr-28">
        <div role="radiogroup" aria-label="Leads affichés sur la carte" className="inline-flex rounded-full border border-frame bg-card p-0.5">
          {(
            [
              ["today", "Aujourd’hui", locatedToday],
              ["all", "Tous les leads", locatedAll],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={scope === key}
              onClick={() => setScope(key)}
              className={`flex h-8 items-center gap-2 rounded-full px-3 text-small font-medium ${scope === key ? "bg-accent text-white" : "text-ink hover:bg-field"}`}
            >
              {label}
              <span className="font-mono">{n}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", ...stages.map((st) => st.key)] as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`flex h-9 items-center gap-2 rounded-full border px-3 text-small font-medium ${
                filter === key ? "border-accent-press bg-accent text-white" : "border-frame bg-card text-ink hover:bg-field"
              }`}
            >
              {key !== "all" && (
                <span aria-hidden className="size-2.5 rounded-full border border-white/80 ring-1 ring-black/10" style={{ background: stageOf(stages, key).color }} />
              )}
              {key === "all" ? "Toutes étapes" : stageOf(stages, key).name}
              <span className="font-mono">{counts[key] ?? 0}</span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={showRoute}
            onClick={() => setShowRoute((v) => !v)}
            className={`flex h-9 items-center rounded-full border px-3 text-small font-medium ${
              showRoute ? "border-accent-press bg-accent text-white" : "border-frame bg-card text-ink hover:bg-field"
            }`}
          >
            Parcours affiché
          </button>
        </div>
      </div>

      <button
        ref={toggleButton}
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-pressed={expanded}
        aria-label={expanded ? "Réduire la carte" : "Agrandir la carte"}
        className="absolute right-3 top-3 z-10 flex h-9 items-center gap-2 rounded-full border border-frame bg-card px-3 text-small font-medium hover:bg-field"
      >
        {expanded ? <ShrinkIcon size={16} /> : <ExpandIcon size={16} />}
        {expanded ? "Réduire" : "Agrandir"}
      </button>

      {(error || info) && (
        <div className="absolute inset-x-3 top-32 z-20 mx-auto max-w-md">
          <Notice onClose={() => (error ? setError(null) : setInfo(null))}>{error ?? info}</Notice>
        </div>
      )}

      {located.length === 0 && (
        <div className="absolute inset-0 z-10 grid place-items-center p-6">
          <div className="max-w-sm rounded-card border border-frame bg-card p-4 text-center">
            {scope === "today" && locatedAll > 0 ? (
              <>
                <p className="text-body font-semibold">Aucun lead pour aujourd’hui</p>
                <p className="mt-1 text-small text-muted">Les leads créés, visités ou planifiés aujourd’hui apparaissent ici.</p>
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className="mt-3 text-small font-medium text-link underline decoration-dotted decoration-2 underline-offset-4"
                >
                  Afficher tous les leads
                </button>
              </>
            ) : (
              <>
                <p className="text-body font-semibold">Aucun lead sur la carte</p>
                <p className="mt-1 text-small text-muted">Chaque lead apparaît ici dès qu&apos;il a une position : saisie, adresse ou lien Google Maps.</p>
                <Link href={ROUTES.leads} className="mt-3 inline-block text-small font-medium text-link underline decoration-dotted decoration-2 underline-offset-4">
                  Ajouter un lead
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* leads sans position : on le dit plutôt que de les laisser disparaître */}
      {unplaced > 0 && located.length > 0 && (
        <button
          type="button"
          onClick={placeMissing}
          disabled={busy}
          className="absolute bottom-9 left-3 z-10 rounded-full border border-frame bg-card px-3 py-1.5 text-small hover:bg-field disabled:opacity-60"
        >
          {unplaced} {unplaced > 1 ? "leads sans position" : "lead sans position"} · <span className="font-medium text-link">les placer</span>
        </button>
      )}

      {/* bulle ancrée au repère, avec pointe */}
      {selected && anchor && (
        <div
          className="absolute z-20 w-72 rounded-card border border-frame bg-card p-4"
          style={{
            left: anchor.x,
            top: anchor.y,
            transform: flip ? "translate(-50%, 18px)" : "translate(-50%, calc(-100% - 18px))",
          }}
        >
          <span
            aria-hidden
            className={`absolute left-1/2 size-3 -translate-x-1/2 rotate-45 bg-card ${
              flip ? "-top-[7px] border-l border-t border-frame" : "-bottom-[7px] border-b border-r border-frame"
            }`}
          />
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="Fermer"
            className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full text-body text-muted hover:bg-field"
          >
            ×
          </button>
          <LeadSummary lead={selected} busy={busy} onToggleVisited={() => toggleVisited(selected)} onEdit={onOpen ? () => onOpen(selected) : undefined} />
        </div>
      )}
    </div>
    </div>
  );
}

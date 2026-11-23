"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, errorMessage, type Lead } from "@/lib/api";
import { useSession } from "@/lib/session";
import { StatusTag } from "./status-tag";
import { Button, Notice } from "./ui";

type Filter = "all" | "to_visit" | "visited";
type Located = Lead & { lat: number; lng: number };

const COLOR_TO_VISIT = "#0868c9";
const COLOR_VISITED = "#07625a";
const DEFAULT_CENTER: [number, number] = [2.42, 6.37];

const isLocated = (l: Lead): l is Located => l.lat !== null && l.lng !== null;
const isVisited = (l: Lead) => l.visitedAt !== null;

/** Ordre de tournée : on enchaîne toujours le lieu non visité le plus proche. */
function routeOrder(points: Located[]): [number, number][] {
  const rest = points.slice();
  if (!rest.length) return [];
  const out = [rest.shift()!];
  while (rest.length) {
    const last = out[out.length - 1];
    let best = 0;
    let bestD = Infinity;
    rest.forEach((p, i) => {
      const d = (p.lat - last.lat) ** 2 + (p.lng - last.lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    out.push(rest.splice(best, 1)[0]);
  }
  return out.map((p) => [p.lng, p.lat]);
}

const empty = { type: "FeatureCollection", features: [] } as const;

export function LeadMap({ leads, onChanged }: { leads: Lead[]; onChanged: () => void }) {
  const { companyId } = useSession();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [showRoute, setShowRoute] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const located = useMemo(() => leads.filter(isLocated), [leads]);
  const counts = {
    all: located.length,
    to_visit: located.filter((l) => !isVisited(l)).length,
    visited: located.filter(isVisited).length,
  };
  const visible = useMemo(
    () =>
      located.filter((l) => (filter === "all" ? true : filter === "visited" ? isVisited(l) : !isVisited(l))),
    [located, filter],
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
        m.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": COLOR_TO_VISIT, "line-width": 3, "line-dasharray": [2, 2], "line-opacity": 0.8 },
        });
        m.addLayer({
          id: "leads-circle",
          type: "circle",
          source: "leads",
          paint: {
            "circle-radius": 9,
            "circle-color": ["case", ["get", "visited"], COLOR_VISITED, COLOR_TO_VISIT],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2.5,
          },
        });
        m.on("mouseenter", "leads-circle", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "leads-circle", () => (m.getCanvas().style.cursor = ""));
        m.on("click", (e) => {
          const hit = m.queryRenderedFeatures(e.point, { layers: ["leads-circle"] })[0];
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

  // --- données de la carte ---
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("leads") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: visible.map((l) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [l.lng, l.lat] },
        properties: { id: l.id, visited: isVisited(l), name: l.name },
      })),
    });
    const line = showRoute && filter !== "visited" ? routeOrder(visible.filter((l) => !isVisited(l))) : [];
    (map.getSource("route") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: line.length > 1 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: line }, properties: {} }] : [],
    });
  }, [ready, visible, showRoute, filter]);

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

  async function toggleVisited(lead: Lead) {
    setBusy(true);
    setError(null);
    try {
      await api(`/leads/${lead.id}`, { method: "PATCH", body: { visited: !isVisited(lead) }, companyId });
      onChanged();
    } catch (e) {
      setError(errorMessage(e instanceof ApiError ? e.code : null));
    } finally {
      setBusy(false);
    }
  }

  const flip = anchor !== null && anchor.y < 280; // vraiment pas de place au-dessus : la bulle passe dessous

  return (
    <div className="relative h-[460px] overflow-hidden md:h-[560px]">
      {/* MapLibre impose position:relative à son conteneur : on lui donne donc une taille explicite dans un cadre absolu */}
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>

      {/* filtres et bascule, en haut à gauche */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        {(
          [
            ["all", "Tous"],
            ["to_visit", "À visiter"],
            ["visited", "Visités"],
          ] as const
        ).map(([key, label]) => (
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
              <span
                aria-hidden
                className="size-2.5 rounded-full border border-white"
                style={{ background: key === "visited" ? COLOR_VISITED : COLOR_TO_VISIT }}
              />
            )}
            {label}
            <span className="font-mono">{counts[key]}</span>
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

      {error && (
        <div className="absolute inset-x-3 top-16 z-20 mx-auto max-w-md">
          <Notice onClose={() => setError(null)}>{error}</Notice>
        </div>
      )}

      {located.length === 0 && (
        <div className="absolute inset-0 z-10 grid place-items-center p-6">
          <div className="max-w-sm rounded-card border border-frame bg-card p-4 text-center">
            <p className="text-body font-semibold">Aucun lead sur la carte</p>
            <p className="mt-1 text-small text-muted">
              Les leads apparaissent ici dès qu&apos;ils ont une position. Ajoutez-en un depuis la page Leads.
            </p>
            <Link href="/leads" className="mt-3 inline-block text-small font-medium text-link underline decoration-dotted decoration-2 underline-offset-4">
              Ajouter un lead
            </Link>
          </div>
        </div>
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 pr-7">
              <div>
                <StatusTag status={selected.status} />
              </div>
              <p className="text-title font-semibold leading-snug">{selected.name}</p>
            </div>
            <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-2 text-small">
              <dt className="text-muted">Secteur</dt>
              <dd>{selected.sector || "—"}</dd>
              <dt className="text-muted">Contact</dt>
              <dd>{selected.contactName || "—"}</dd>
              <dt className="text-muted">Téléphone</dt>
              <dd className="font-mono">{selected.phone || "—"}</dd>
              <dt className="text-muted">Visite</dt>
              <dd>{selected.visitedAt ? new Date(selected.visitedAt).toLocaleDateString("fr-FR") : "Pas encore visité"}</dd>
            </dl>
            <div className="flex gap-2">
              <Button className="h-9 flex-1" loading={busy} onClick={() => toggleVisited(selected)}>
                {isVisited(selected) ? "Remettre à visiter" : "Marquer visité"}
              </Button>
              <a
                href={`https://www.openstreetmap.org/directions?route=%3B${selected.lat}%2C${selected.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-control border border-frame bg-card px-3 text-small font-medium hover:bg-field"
              >
                Itinéraire
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

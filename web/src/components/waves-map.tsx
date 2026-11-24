"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import type { Map as MLMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lead } from "@/lib/api";
import { PHASE_LABEL, PHASE_TOKEN, circlePolygon, regionPhase, type Region, type Wave, type WavePhase } from "@/lib/waves";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldData from "world-atlas/countries-110m.json";
import { cssVar } from "@/lib/theme";
import { ExpandIcon, ShrinkIcon } from "./icons";

/** Quel panneau occupe toute la hauteur : aucun (les deux), le globe ou la carte. */
type Mode = "both" | "globe" | "map";

const world = worldData as unknown as Topology<{ land: GeometryCollection; countries: GeometryCollection }>;
const land = feature(world, world.objects.land);
const borders = mesh(world, world.objects.countries, (a, b) => a !== b);
const graticule = geoGraticule10();

const FIRST_VIEW: [number, number] = [2.42, 6.37];

/** Globe en fil de fer (canvas) : tourne tout seul, se fait glisser, et un clic envoie la carte à cet endroit. */
function Globe({ onPick, focus }: { onPick: (lng: number, lat: number) => void; focus: [number, number] | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rotation = useRef<[number, number]>([-FIRST_VIEW[0], -20]);
  const focusRef = useRef(focus);
  const dragging = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const hovered = useRef(false);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
    focusRef.current = focus;
  }, [onPick, focus]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let radius = 0;
    const projection = geoOrthographic().clipAngle(90).precision(0.4);
    const path = geoPath(projection, ctx);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = Math.max(40, Math.min(w, h) / 2 - 14);
      projection.translate([w / 2, h / 2]).scale(radius);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    // couleurs lues une fois dans les jetons de globals.css (le canevas ne comprend pas var(--…))
    const line = cssVar("--color-globe-line");
    const glowColor = cssVar("--color-globe-glow");
    const bg = cssVar("--color-globe-bg");
    const marker = cssVar("--color-globe-marker");

    const draw = () => {
      projection.rotate([rotation.current[0], rotation.current[1], 0]);
      ctx.clearRect(0, 0, w, h);
      // la sphère : léger dégradé pour lui donner du volume
      const glow = ctx.createRadialGradient(w / 2 - radius * 0.3, h / 2 - radius * 0.3, radius * 0.1, w / 2, h / 2, radius);
      glow.addColorStop(0, glowColor);
      glow.addColorStop(1, bg);
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = line;
      ctx.stroke();

      ctx.beginPath();
      path(graticule);
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = line;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      path(borders);
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = line;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      path(land);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = line;
      ctx.stroke();

      const f = focusRef.current;
      if (f) {
        const p = projection(f);
        // on ne dessine le repère que s'il est sur la face visible
        if (p && distanceToCenter(f, rotation.current) < 90) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 5, 0, Math.PI * 2);
          ctx.fillStyle = marker;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p[0], p[1], 11, 0, Math.PI * 2);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = marker;
          ctx.stroke();
        }
      }
    };

    const tick = () => {
      if (!dragging.current && !hovered.current && !reduced) rotation.current = [rotation.current[0] + 0.12, rotation.current[1]];
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const pointOf = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as [number, number];
    };
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      dragging.current = { x: e.clientX, y: e.clientY, moved: false };
    };
    const move = (e: PointerEvent) => {
      const d = dragging.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      const k = 90 / radius; // degrés par pixel : la surface suit le doigt
      rotation.current = [rotation.current[0] + dx * k, Math.max(-85, Math.min(85, rotation.current[1] - dy * k))];
      d.x = e.clientX;
      d.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      const d = dragging.current;
      dragging.current = null;
      if (!d || d.moved) return;
      const [x, y] = pointOf(e);
      const ll = projection.invert?.([x, y]);
      // invert renvoie un point même hors du disque : on vérifie qu'on a bien cliqué sur la sphère
      if (ll && Math.hypot(x - w / 2, y - h / 2) <= radius) onPickRef.current(ll[0], ll[1]);
    };
    const enter = () => (hovered.current = true);
    const leave = () => (hovered.current = false);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label="Globe terrestre en fil de fer. Faites-le glisser pour le tourner, cliquez sur un endroit pour y envoyer la carte."
      className="block size-full cursor-grab touch-pan-y active:cursor-grabbing"
    />
  );
}

/** Distance angulaire (en degrés) entre un point et le centre visible du globe. */
function distanceToCenter([lng, lat]: [number, number], [rl, rp]: [number, number]): number {
  const rad = Math.PI / 180;
  const cLng = -rl * rad;
  const cLat = -rp * rad;
  const cos = Math.sin(lat * rad) * Math.sin(cLat) + Math.cos(lat * rad) * Math.cos(cLat) * Math.cos(lng * rad - cLng);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / rad;
}

function Panel({
  title,
  mode,
  me,
  setMode,
  className,
  children,
}: {
  title: string;
  mode: Mode;
  me: "globe" | "map";
  setMode: (m: Mode) => void;
  className: string;
  children: React.ReactNode;
}) {
  const full = mode === me;
  return (
    <div className={`relative min-h-0 overflow-hidden ${className}`}>
      {children}
      <button
        type="button"
        onClick={() => setMode(full ? "both" : me)}
        aria-pressed={full}
        aria-label={full ? `Réduire : ${title}` : `Agrandir : ${title} sur toute la hauteur`}
        title={full ? "Réduire" : "Agrandir sur toute la hauteur"}
        className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-control border border-white/30 bg-black/45 text-white backdrop-blur hover:bg-black/65"
      >
        {full ? <ShrinkIcon size={18} /> : <ExpandIcon size={18} />}
      </button>
    </div>
  );
}

const PHASES: WavePhase[] = ["active", "overdue", "planned", "closed"];

type Located = { id: string; lat: number; lng: number; regionId: string | null };

/** Couleur d'une région ou d'un lead selon la vague de sa région ; gris neutre sans vague. */
const colorOf = (phase: WavePhase | null) => cssVar(phase ? PHASE_TOKEN[phase] : "--color-neutral");

/** Globe en haut, carte en bas : régions et leads colorés selon le statut de la vague de leur région. */
export function WavesMap({ regions, waves, leads }: { regions: Region[]; waves: Wave[]; leads: Lead[] }) {
  const [mode, setMode] = useState<Mode>("both");
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [near, setNear] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);

  // La carte (et ses tuiles) ne se charge que lorsque la section approche de l'écran.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let map: MLMap | null = null;
    let observer: ResizeObserver | null = null;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new maplibregl.Map({
        container: container.current,
        center: FIRST_VIEW,
        zoom: 3,
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
      mapRef.current = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      m.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), "bottom-left");
      // le panneau change de hauteur : la carte doit recalculer sa taille
      observer = new ResizeObserver(() => m.resize());
      observer.observe(container.current);
      m.on("load", () => !cancelled && setReady(true));
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [near]);

  // Régions (cercles) et leads (points) : redessinés quand les données changent.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const phases = new Map(regions.map((r) => [r.id, regionPhase(waves, r.id)]));
    const circles = {
      type: "FeatureCollection" as const,
      features: regions.map((r) => ({
        type: "Feature" as const,
        properties: { color: colorOf(phases.get(r.id) ?? null), name: r.name },
        geometry: { type: "Polygon" as const, coordinates: [circlePolygon(r.lng, r.lat, r.radiusKm)] },
      })),
    };
    const located = leads.filter((l): l is Lead & Located => l.lat !== null && l.lng !== null);
    const points = {
      type: "FeatureCollection" as const,
      features: located.map((l) => ({
        type: "Feature" as const,
        properties: { color: colorOf(l.regionId ? (phases.get(l.regionId) ?? null) : null) },
        geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
      })),
    };
    const set = (id: string, data: typeof circles | typeof points) => {
      const src = map.getSource(id) as { setData: (d: unknown) => void } | undefined;
      if (src) src.setData(data);
      else map.addSource(id, { type: "geojson", data: data as never });
    };
    set("regions", circles);
    set("lead-points", points);
    if (!map.getLayer("region-fill")) {
      map.addLayer({ id: "region-fill", type: "fill", source: "regions", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.18 } });
      map.addLayer({ id: "region-line", type: "line", source: "regions", paint: { "line-color": ["get", "color"], "line-width": 2 } });
      map.addLayer({
        id: "lead-dots",
        type: "circle",
        source: "lead-points",
        paint: { "circle-radius": 5, "circle-color": ["get", "color"], "circle-stroke-color": cssVar("--color-page"), "circle-stroke-width": 1.5 },
      });
    }
    // premier affichage : cadrer sur les régions (sinon sur les leads), une seule fois
    const coords: [number, number][] = regions.length ? regions.flatMap((r) => circlePolygon(r.lng, r.lat, r.radiusKm, 8)) : located.map((l) => [l.lng, l.lat]);
    if (!fitted.current && coords.length) {
      fitted.current = true;
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 12, duration: 0 });
    }
  }, [ready, regions, waves, leads]);

  const pick = useCallback((lng: number, lat: number) => {
    setFocus([lng, lat]);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 6, duration: 1400 });
  }, []);

  // 1fr / 1fr, ou 1fr / 0fr, ou 0fr / 1fr : un panneau prend toute la hauteur, l'autre disparaît.
  const rows = mode === "globe" ? "1fr 0fr" : mode === "map" ? "0fr 1fr" : "1fr 1fr";

  return (
    <div
      ref={root}
      style={{ gridTemplateRows: rows }}
      className={`grid h-[620px] ${mode === "both" ? "gap-3" : "gap-0"} transition-[grid-template-rows] duration-300 motion-reduce:transition-none md:h-[720px]`}
    >
      <Panel title="le globe" mode={mode} me="globe" setMode={setMode} className="rounded-card bg-globe-bg">
        <Globe onPick={pick} focus={focus} />
      </Panel>
      <Panel title="la carte" mode={mode} me="map" setMode={setMode} className="rounded-card border border-border bg-field">
        <div ref={container} className="size-full" />
        <ul aria-label="Légende" className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-control border border-border bg-card/90 px-3 py-2 text-small backdrop-blur">
          {PHASES.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: `var(${PHASE_TOKEN[p]})` }} />
              {PHASE_LABEL[p]}
            </li>
          ))}
          <li className="flex items-center gap-2 text-muted">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: "var(--color-neutral)" }} />
            Hors vague
          </li>
        </ul>
      </Panel>
    </div>
  );
}

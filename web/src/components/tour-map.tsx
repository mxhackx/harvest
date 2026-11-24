"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { cssVar } from "@/lib/theme";
import type { TourPoint, TourStop } from "@/lib/tours";

const FIRST_VIEW: [number, number] = [2.42, 6.37];

/**
 * Carte d'une tournée : l'itinéraire routier en trait, le départ, les étapes numérotées dans l'ordre. En mode « placer le
 * départ », un clic sur la carte choisit le point de départ.
 */
export function TourMap({
  start,
  end,
  stops,
  geometry,
  pickStart,
  onPickStart,
}: {
  start: TourPoint | null;
  end: TourPoint | null;
  stops: TourStop[];
  geometry: [number, number][];
  pickStart: boolean;
  onPickStart: (lat: number, lng: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const pick = useRef({ pickStart, onPickStart });
  useEffect(() => {
    pick.current = { pickStart, onPickStart };
  });

  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new maplibregl.Map({
        container: container.current,
        center: FIRST_VIEW,
        zoom: 11,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© contributeurs OpenStreetMap" } },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });
      map = m;
      mapRef.current = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      m.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), "bottom-left");
      m.on("click", (e) => pick.current.pickStart && pick.current.onPickStart(e.lngLat.lat, e.lngLat.lng));
      m.on("load", () => {
        m.addSource("tour-line", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
        m.addLayer({ id: "tour-casing", type: "line", source: "tour-line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": cssVar("--color-page"), "line-width": 8 } });
        m.addLayer({ id: "tour-line", type: "line", source: "tour-line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": cssVar("--color-wave-active"), "line-width": 4 } });
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      markers.current.forEach((x) => x.remove());
      markers.current = [];
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // l'itinéraire et les repères suivent les données
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      (map.getSource("tour-line") as unknown as { setData: (d: unknown) => void }).setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: geometry } });
      markers.current.forEach((x) => x.remove());
      const mark = (lng: number, lat: number, text: string, color: string, title: string) => {
        const el = document.createElement("div");
        el.textContent = text;
        el.title = title;
        el.setAttribute("aria-label", title);
        el.style.cssText = `width:30px;height:30px;border-radius:9999px;background:${color};color:#fff;border:2px solid ${cssVar("--color-page")};display:flex;align-items:center;justify-content:center;font:600 13px system-ui,sans-serif`;
        return new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      };
      const out: Marker[] = [];
      if (start) out.push(mark(start.lng, start.lat, "D", cssVar("--color-forest"), `Départ : ${start.label || "point de départ"}`));
      stops.forEach((s, i) => out.push(mark(s.lng, s.lat, String(i + 1), cssVar("--color-wave-active"), `Étape ${i + 1} : ${s.name}`)));
      if (end) out.push(mark(end.lng, end.lat, "A", cssVar("--color-wave-overdue"), "Arrivée"));
      markers.current = out;
      const pts: [number, number][] = geometry.length ? geometry : [...(start ? [[start.lng, start.lat] as [number, number]] : []), ...stops.map((s) => [s.lng, s.lat] as [number, number])];
      if (pts.length) {
        const lngs = pts.map((p) => p[0]);
        const lats = pts.map((p) => p[1]);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15, duration: 400 });
      }
    })();
  }, [ready, start, end, stops, geometry]);

  return <div ref={container} className={`size-full ${pickStart ? "cursor-crosshair" : ""}`} aria-label="Carte de la tournée" />;
}

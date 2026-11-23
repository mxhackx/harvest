"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";

export type Coords = { lat: number; lng: number };

const DEFAULT_CENTER: [number, number] = [2.42, 6.37];

/**
 * Mini-carte pour placer un lead avec précision : un clic place le repère, qu'on peut ensuite glisser.
 * `value` est la source de vérité (champs de saisie, géolocalisation, recherche d'adresse).
 */
export function LocationPicker({ value, onChange }: { value: Coords | null; onChange: (c: Coords) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  // toujours la dernière version du callback, sans recréer la carte
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const placed = useRef(false); // le repère est-il sur la carte ?
  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  });

  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const start = valueRef.current;
      const m = new maplibregl.Map({
        container: container.current,
        center: start ? [start.lng, start.lat] : DEFAULT_CENTER,
        zoom: start ? 16 : 11,
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

      const marker = new maplibregl.Marker({ draggable: true, color: "#0868c9" });
      markerRef.current = marker;
      if (start) {
        marker.setLngLat([start.lng, start.lat]).addTo(m);
        placed.current = true;
      }
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      m.on("click", (e) => {
        marker.setLngLat(e.lngLat).addTo(m);
        placed.current = true;
        onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      mapRef.current = m;
    })();
    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  // la position change depuis l'extérieur (saisie, géolocalisation, adresse) : le repère suit
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (!value) {
      marker.remove();
      placed.current = false;
      return;
    }
    const at = marker.getLngLat();
    const moved = !placed.current || Math.abs(at.lat - value.lat) > 1e-7 || Math.abs(at.lng - value.lng) > 1e-7;
    if (moved) {
      marker.setLngLat([value.lng, value.lat]).addTo(map);
      placed.current = true;
      map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 15), duration: 400 });
    }
  }, [value]);

  return (
    <div className="relative h-56 overflow-hidden rounded-control border border-border">
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>
      {!value && (
        <p className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-frame bg-card px-3 py-1 text-small text-muted">
          Cliquez sur la carte pour placer le lead
        </p>
      )}
    </div>
  );
}

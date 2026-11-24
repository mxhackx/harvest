export type TourPoint = { lat: number; lng: number; label: string };
export type TourStop = { leadId: string; name: string; city: string; phone: string; lat: number; lng: number };
export type TourPlan = {
  stops: TourStop[];
  legs: { distanceKm: number; durationMin: number }[];
  totalKm: number;
  drivingMin: number;
  totalMin: number;
  arrivals: string[];
  endsAt: string;
  geometry: [number, number][];
  approximate: boolean;
};
export type Tour = Omit<TourPlan, "drivingMin" | "totalMin" | "stops" | "geometry"> & {
  id: string;
  name: string;
  plannedOn: string;
  startTime: string;
  stopMinutes: number;
  start: TourPoint;
  end: TourPoint | null;
  stops: TourStop[];
  geometry: [number, number][];
  totalMin: number;
  status: "planned" | "done";
};

/** 95 → « 1 h 35 » ; 40 → « 40 min » ; 120 → « 2 h ». */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export const formatKm = (km: number): string => `${km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;

/**
 * Lien Google Maps de la tournée (itinéraire en voiture, départ, étapes et arrivée). Google accepte au plus 9 étapes
 * intermédiaires : au-delà, on garde les 9 premières et on le dit à l'appelant (`truncated`).
 */
export function googleMapsUrl(start: TourPoint, stops: { lat: number; lng: number }[], end: TourPoint | null): { url: string; truncated: boolean } {
  const pt = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`;
  const all = [...stops];
  const destination = end ?? all.pop();
  const truncated = all.length > 9;
  const params = new URLSearchParams({ api: "1", travelmode: "driving", origin: pt(start), destination: destination ? pt(destination) : pt(start) });
  if (all.length) params.set("waypoints", all.slice(0, 9).map(pt).join("|"));
  return { url: `https://www.google.com/maps/dir/?${params}`, truncated };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Fichier GPX (waypoints et trace) à ouvrir dans une application de navigation ou de randonnée. */
export function toGpx(name: string, start: TourPoint, stops: TourStop[], geometry: [number, number][]): string {
  const wpt = (p: { lat: number; lng: number }, label: string) => `<wpt lat="${p.lat}" lon="${p.lng}"><name>${esc(label)}</name></wpt>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Hivation" xmlns="http://www.topografix.com/GPX/1/1">',
    `<metadata><name>${esc(name)}</name></metadata>`,
    wpt(start, start.label || "Départ"),
    ...stops.map((s, i) => wpt(s, `${i + 1}. ${s.name}`)),
    `<trk><name>${esc(name)}</name><trkseg>${geometry.map(([lng, lat]) => `<trkpt lat="${lat}" lon="${lng}"/>`).join("")}</trkseg></trk>`,
    "</gpx>",
    "",
  ].join("\n");
}

/** Ajoute ou retire un prospect de la sélection, sans dépasser `max` étapes (l'ordre de sélection est gardé). */
export function toggleStop(selected: string[], id: string, max = 30): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  return selected.length >= max ? selected : [...selected, id];
}

/** Déplace l'élément d'une place vers le haut (-1) ou le bas (+1) ; sans effet aux extrémités. */
export function moveStop<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const out = [...list];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

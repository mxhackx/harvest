import { config } from "../config.js";

export type Point = { lat: number; lng: number };
export type Leg = { distanceKm: number; durationMin: number };
export type Plan = {
  /** indices des points d'entrée, dans l'ordre de visite (le départ d'abord, l'arrivée fixée en dernier) */
  order: number[];
  /** un tronçon entre deux points consécutifs de l'ordre */
  legs: Leg[];
  totalKm: number;
  totalMin: number;
  /** tracé de l'itinéraire : [longitude, latitude] */
  geometry: [number, number][];
  /** vrai quand le tracé et les durées sont estimés (ligne droite) faute de service d'itinéraires */
  approximate: boolean;
};

const R = 6371;
/** Distance à vol d'oiseau en km. */
export function haversineKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimation hors service d'itinéraires : les routes font environ 30 % de plus que la ligne droite, à 35 km/h en ville. */
const ROAD_FACTOR = 1.3;
const SPEED_KMH = 35;

/**
 * Ordre de visite estimé : on part du départ, on va toujours au plus proche, puis des échanges « 2-opt » défont les
 * croisements. Le départ reste premier ; avec une arrivée fixée (`fixedEnd`), le dernier point reste dernier.
 */
export function orderStops(points: Point[], fixedEnd: boolean): number[] {
  const n = points.length;
  if (n <= 2) return points.map((_, i) => i);
  const last = fixedEnd ? n - 1 : -1;
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => i !== 0 && i !== last);
  const path = [0];
  while (free.length) {
    const from = points[path[path.length - 1]];
    let best = 0;
    for (let i = 1; i < free.length; i++) if (haversineKm(from, points[free[i]]) < haversineKm(from, points[free[best]])) best = i;
    path.push(free.splice(best, 1)[0]);
  }
  if (last >= 0) path.push(last);
  // 2-opt : on retourne un tronçon intérieur s'il raccourcit le parcours (le départ et l'arrivée fixée ne bougent pas)
  const d = (i: number, j: number) => haversineKm(points[path[i]], points[path[j]]);
  const end = last >= 0 ? path.length - 1 : path.length;
  let improved = true;
  for (let rounds = 0; improved && rounds < 50; rounds++) {
    improved = false;
    for (let i = 1; i < end - 1; i++) {
      for (let j = i + 1; j < end; j++) {
        const before = d(i - 1, i) + (j + 1 < path.length ? d(j, j + 1) : 0);
        const after = d(i - 1, j) + (j + 1 < path.length ? d(i, j + 1) : 0);
        if (after < before - 1e-9) {
          path.splice(i, j - i + 1, ...path.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return path;
}

/** Itinéraire estimé en ligne droite, pour quand aucun service d'itinéraires ne répond. */
export function approximatePlan(points: Point[], optimize: boolean, fixedEnd: boolean): Plan {
  const order = optimize ? orderStops(points, fixedEnd) : points.map((_, i) => i);
  const legs: Leg[] = order.slice(1).map((idx, k) => {
    const km = haversineKm(points[order[k]], points[idx]) * ROAD_FACTOR;
    return { distanceKm: round1(km), durationMin: Math.round((km / SPEED_KMH) * 60) };
  });
  return { order, legs, ...totals(legs), geometry: order.map((i) => [points[i].lng, points[i].lat] as [number, number]), approximate: true };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const totals = (legs: Leg[]) => ({ totalKm: round1(legs.reduce((s, l) => s + l.distanceKm, 0)), totalMin: legs.reduce((s, l) => s + l.durationMin, 0) });

type OsrmLeg = { distance: number; duration: number };
const toLegs = (legs: OsrmLeg[]): Leg[] => legs.map((l) => ({ distanceKm: round1(l.distance / 1000), durationMin: Math.round(l.duration / 60) }));

/** Réponse du service « trip » d'OSRM (ordre optimisé) → plan, ou null si elle est inutilisable. */
export function parseTrip(json: unknown, n: number): Plan | null {
  const j = json as { code?: string; trips?: { legs: OsrmLeg[]; geometry: { coordinates: [number, number][] } }[]; waypoints?: { waypoint_index: number }[] };
  if (j?.code !== "Ok" || !j.trips?.[0] || !j.waypoints || j.waypoints.length !== n) return null;
  // waypoints[i].waypoint_index = la place du point i dans la tournée
  const order = j.waypoints.map((w, i) => ({ i, at: w.waypoint_index })).sort((a, b) => a.at - b.at).map((x) => x.i);
  const legs = toLegs(j.trips[0].legs);
  return { order, legs, ...totals(legs), geometry: j.trips[0].geometry.coordinates, approximate: false };
}

/** Réponse du service « route » d'OSRM (ordre imposé) → plan, ou null. */
export function parseRoute(json: unknown, n: number): Plan | null {
  const j = json as { code?: string; routes?: { legs: OsrmLeg[]; geometry: { coordinates: [number, number][] } }[] };
  if (j?.code !== "Ok" || !j.routes?.[0] || j.routes[0].legs.length !== n - 1) return null;
  const legs = toLegs(j.routes[0].legs);
  return { order: Array.from({ length: n }, (_, i) => i), legs, ...totals(legs), geometry: j.routes[0].geometry.coordinates, approximate: false };
}

/**
 * Itinéraire entre des points : par la route si le service répond (optimisé ou dans l'ordre donné), sinon estimé.
 * Le premier point est le départ ; avec `fixedEnd`, le dernier est l'arrivée. Ne lève jamais d'erreur.
 */
export async function planRoute(points: Point[], opts: { optimize: boolean; fixedEnd: boolean }, fetchImpl: typeof fetch = fetch, baseUrl: string = config.routingUrl): Promise<Plan> {
  if (points.length < 2) return { order: points.map((_, i) => i), legs: [], totalKm: 0, totalMin: 0, geometry: points.map((p) => [p.lng, p.lat]), approximate: false };
  if (baseUrl) {
    const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const optimize = opts.optimize && points.length > 2;
    const url = optimize
      ? `${baseUrl}/trip/v1/driving/${coords}?roundtrip=false&source=first${opts.fixedEnd ? "&destination=last" : ""}&overview=full&geometries=geojson`
      : `${baseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "Hivation-Tours/1" } });
      if (res.ok) {
        const plan = (optimize ? parseTrip : parseRoute)(await res.json(), points.length);
        if (plan) return plan;
      }
    } catch {
      /* service injoignable : on retombe sur l'estimation */
    }
  }
  return approximatePlan(points, opts.optimize, opts.fixedEnd);
}

/** Heure « HH:MM » + minutes → « HH:MM » (passe minuit sans bruit : 23:50 + 20 min = 00:10). */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * Horaires d'une tournée : heure d'arrivée à chaque étape (le départ est à `startTime`), et heure de fin, en comptant
 * `stopMinutes` passées sur place à chaque étape. `legs[i]` relie le point i au point i+1.
 */
export function schedule(startTime: string, legs: Leg[], stopMinutes: number): { arrivals: string[]; endsAt: string; totalMinutes: number } {
  const arrivals: string[] = [];
  let elapsed = 0;
  legs.forEach((leg, i) => {
    elapsed += leg.durationMin;
    arrivals.push(addMinutes(startTime, elapsed));
    if (i < legs.length - 1) elapsed += stopMinutes; // on reste sur place à chaque étape sauf l'arrivée
  });
  return { arrivals, endsAt: addMinutes(startTime, elapsed), totalMinutes: elapsed };
}

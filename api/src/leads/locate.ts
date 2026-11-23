import { config } from "../config.js";
import { GOOGLE_MAPS_HOST } from "./fields.js";

export type Coords = { lat: number; lng: number };
export type Located = Coords & { source: "google_maps" | "address"; label?: string };

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/**
 * Extrait des coordonnées d'un lien Google Maps (sans appel réseau). Par ordre de précision :
 * `!3d<lat>!4d<lng>` (le lieu lui-même), `@<lat>,<lng>` (centre de la vue), `?q=` / `?ll=` / `?query=`.
 */
export function parseGoogleMapsCoords(url: string): Coords | null {
  let text = url;
  try {
    // les liens de consentement et de redirection embarquent l'URL d'origine dans un paramètre
    text = decodeURIComponent(url);
  } catch {}
  const patterns = [
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|ll|query|destination)=(-?\d{1,2}(?:\.\d+)?)(?:,|\+)\s*(-?\d{1,3}(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && valid(Number(m[1]), Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

type Fetch = typeof fetch;

/**
 * Suit les liens courts (maps.app.goo.gl…) jusqu'à trouver des coordonnées. Chaque saut doit rester
 * sur un domaine Google en https : le serveur ne se laisse pas rediriger ailleurs (SSRF).
 */
export async function coordsFromGoogleMapsUrl(url: string, f: Fetch = fetch): Promise<Coords | null> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const direct = parseGoogleMapsCoords(current);
    if (direct) return direct;
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      return null;
    }
    if (u.protocol !== "https:" || !GOOGLE_MAPS_HOST.test(u.hostname)) return null;
    const res = await f(u.href, {
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; harvest-api)" },
    }).catch(() => null);
    const next = res?.headers.get("location");
    if (!res || !next) return null;
    current = new URL(next, u).href;
  }
  return parseGoogleMapsCoords(current);
}

// Nominatim impose au plus 1 requête par seconde : on espace les appels.
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

export async function geocodeAddress(query: string, f: Fetch = fetch): Promise<{ coords: Coords; label: string } | null> {
  const q = query.trim();
  if (!q) return null;
  const url = `${config.geocoderUrl}/search?${new URLSearchParams({ q, format: "jsonv2", limit: "1" })}`;
  const res = await throttled(() =>
    f(url, {
      signal: AbortSignal.timeout(5000),
      // Nominatim exige un identifiant d'application ; volontairement générique.
      headers: { "user-agent": "harvest-api", accept: "application/json" },
    }).catch(() => null),
  );
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as { lat: string; lon: string; display_name?: string }[] | null;
  const hit = rows?.[0];
  if (!hit || !valid(Number(hit.lat), Number(hit.lon))) return null;
  return { coords: { lat: Number(hit.lat), lng: Number(hit.lon) }, label: hit.display_name ?? "" };
}

export type LocateInput = { googleMapsUrl?: string; address?: string; city?: string; region?: string };

/** Meilleure position disponible : lien Google Maps d'abord, puis adresse. `null` si rien ne marche. */
export async function locate(input: LocateInput, f: Fetch = fetch): Promise<Located | null> {
  if (input.googleMapsUrl) {
    const c = await coordsFromGoogleMapsUrl(input.googleMapsUrl, f);
    if (c) return { ...c, source: "google_maps" };
  }
  // Sans adresse, on ne place pas le lead « au centre de la ville » : mieux vaut aucune position qu'une fausse.
  if (input.address?.trim() && config.geocodingEnabled) {
    const q = [input.address, input.city || input.region].filter(Boolean).join(", ");
    const hit = await geocodeAddress(q, f);
    if (hit) return { ...hit.coords, source: "address", label: hit.label };
  }
  return null;
}

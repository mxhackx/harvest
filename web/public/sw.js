/* Service worker Hivation : l'application et les dernières données vues restent lisibles sans réseau.
 * Les gestes écrits hors connexion sont mis en attente par l'application (IndexedDB), pas ici.
 * L'adresse de l'API arrive dans l'URL d'enregistrement : /sw.js?api=https://api.exemple.fr */
const STATIC = "hivation-static-v1";
const PAGES = "hivation-pages-v1";
const DATA = "hivation-data-v1";
const TILES = "hivation-tiles-v1";
const MAX_TILES = 400;
const API = new URL(self.location.href).searchParams.get("api") || "";

// Lectures de l'API gardées (même liste que lib/offline-rules.ts ; un test vérifie qu'elles ne divergent pas)
const CACHED_GET = ["/me", "/leads", "/stages", "/regions", "/waves", "/tasks", "/events", "/custom-fields"];
const CACHED_GET_LEAD = ["activities", "contacts"];
const LEAD_PATH = new RegExp("^/leads/[0-9a-f-]{36}/(" + CACHED_GET_LEAD.join("|") + ")$");

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.add("/offline")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = [STATIC, PAGES, DATA, TILES];
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((n) => n.startsWith("hivation-") && !keep.includes(n)).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

// La page demande d'oublier les données (déconnexion, changement de compte) : rien de personnel ne reste sur l'appareil.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear") event.waitUntil(Promise.all([caches.delete(DATA), caches.delete(PAGES)]));
  // une page qui vient de s'ouvrir demande où on en est (elle a pu rater les messages envoyés avant son démarrage)
  if (event.data && event.data.type === "status" && event.source) event.source.postMessage({ type: lastState });
});

const isApiRead = (url) => API && url.origin === API && (CACHED_GET.includes(url.pathname) || LEAD_PATH.test(url.pathname));
/** Une réponse par entreprise : la clé porte l'identifiant d'entreprise (en-tête x-company-id). */
const dataKey = (request, url) => new Request(url.origin + url.pathname + url.search + "#" + (request.headers.get("x-company-id") || ""));

/** Prévient les pages ouvertes : « stale » quand une lecture de l'API vient de la copie (pas de réseau), « fresh » quand elle vient du réseau. */
let lastState = "fresh";
async function tell(type) {
  lastState = type;
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((c) => c.postMessage({ type }));
}

async function networkFirst(request, cacheName, key) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(key || request, res.clone());
    if (cacheName === DATA && res && res.ok) tell("fresh");
    return res;
  } catch (err) {
    const hit = await cache.match(key || request);
    if (!hit) throw err;
    if (cacheName === DATA) tell("stale");
    return hit;
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && (res.ok || res.type === "opaque")) {
    cache.put(request, res.clone());
    if (limit) cache.keys().then((keys) => keys.length > limit && cache.delete(keys[0]));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isApiRead(url)) {
    event.respondWith(networkFirst(request, DATA, dataKey(request, url)));
    return;
  }
  if (url.origin === self.location.origin) {
    // Code de l'application : réseau d'abord (toujours à jour), la copie seulement quand le réseau manque
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/maplibre/")) {
      event.respondWith(networkFirst(request, STATIC));
      return;
    }
    // Images et polices : cache d'abord
    if (/\.(png|svg|ico|woff2)$/.test(url.pathname)) {
      event.respondWith(cacheFirst(request, STATIC));
      return;
    }
    // Pages de l'espace connecté : réseau d'abord ; hors ligne, la dernière copie, sinon l'accueil de l'espace, sinon la page « hors connexion »
    if (request.mode === "navigate" && url.pathname.startsWith("/dashboard")) {
      event.respondWith(
        networkFirst(request, PAGES).catch(async () => (await caches.match(request)) || (await (await caches.open(PAGES)).match("/dashboard")) || (await caches.match("/offline"))),
      );
      return;
    }
    if (request.mode === "navigate") {
      event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    }
    return;
  }
  // Fonds de carte OpenStreetMap déjà vus : ils restent affichables hors ligne
  if (url.hostname === "tile.openstreetmap.org") event.respondWith(cacheFirst(request, TILES, MAX_TILES));
});

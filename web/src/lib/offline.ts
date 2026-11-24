import { replay, type FlushResult, type Queueable } from "./offline-rules";

/** Gestes écrits hors connexion, gardés dans le navigateur (IndexedDB) jusqu'au retour du réseau. */
export type Entry = Queueable & { id?: number; companyId: string; at: number };

const DB = "hivation-offline";
const STORE = "queue";
/** Événement de la fenêtre : { type: "queued", entry } quand un geste est mis en attente, { type: "flushed", result } après envoi. */
export const QUEUE_EVENT = "hivation-queue";
export type QueueEventDetail = { type: "queued"; entry: Entry } | { type: "flushed"; result: FlushResult };

/** Événement de la fenêtre : { stale } — vrai quand une lecture vient de la copie gardée (pas de réseau), faux dès qu'une lecture réussit (signalé par le service worker). */
export const REACH_EVENT = "hivation-reach";
export const reportReach = (stale: boolean) => window.dispatchEvent(new CustomEvent<{ stale: boolean }>(REACH_EVENT, { detail: { stale } }));

const emit = (detail: QueueEventDetail) => window.dispatchEvent(new CustomEvent<QueueEventDetail>(QUEUE_EVENT, { detail }));

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export const pending = (): Promise<Entry[]> => run("readonly", (s) => s.getAll() as IDBRequest<Entry[]>);
export const pendingCount = (): Promise<number> => run("readonly", (s) => s.count());

/** Met un geste en attente et prévient l'écran (pour qu'il l'affiche tout de suite). */
export async function queueGesture(entry: Omit<Entry, "at">): Promise<void> {
  const full: Entry = { ...entry, at: Date.now() };
  await run("readwrite", (s) => s.add(full));
  emit({ type: "queued", entry: full });
}

let flushing = false;

/** Envoie les gestes en attente, dans l'ordre, dès que le réseau est là. Un seul envoi à la fois. */
export async function flushQueue(apiUrl: string): Promise<FlushResult | null> {
  if (flushing) return null;
  flushing = true;
  try {
    const entries = await pending();
    if (entries.length === 0) return null;
    const result = await replay(
      entries,
      async (e) => {
        try {
          const res = await fetch(`${apiUrl}${e.path}`, {
            method: e.method,
            credentials: "include",
            headers: { "content-type": "application/json", ...(e.companyId ? { "x-company-id": e.companyId } : {}) },
            body: JSON.stringify(e.body),
          });
          return res.status;
        } catch {
          return null; // pas de réseau : on garde la suite
        }
      },
      (id) => run("readwrite", (s) => s.delete(id)).then(() => undefined),
    );
    emit({ type: "flushed", result });
    return result;
  } finally {
    flushing = false;
  }
}

/** Enregistre le service worker (lecture hors ligne). L'adresse de l'API lui est passée dans l'URL. */
export function registerServiceWorker(apiUrl: string): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(`/sw.js?api=${encodeURIComponent(apiUrl)}`).catch(() => {});
  // le service worker dit si une lecture vient de la copie (hors connexion) ou du réseau
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "stale" || e.data?.type === "fresh") reportReach(e.data.type === "stale");
  });
  navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: "status" })).catch(() => {});
}

/** Déconnexion ou changement de compte : on efface les données gardées pour le hors-ligne (cache et gestes en attente). */
export async function forgetOfflineData(): Promise<void> {
  try {
    (await navigator.serviceWorker?.ready)?.active?.postMessage({ type: "clear" });
    await run("readwrite", (s) => s.clear());
  } catch {
    /* navigateur sans service worker ou IndexedDB : rien à effacer */
  }
}

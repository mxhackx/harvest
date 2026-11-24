import type { Lead } from "./api";

/**
 * Règles du mode hors-ligne, partagées par l'application et vérifiées contre public/sw.js (test).
 * Hors connexion : on peut lire ce qu'on a déjà vu, et mettre en attente deux gestes de terrain — marquer un lead
 * visité (ou changer son étape) et ajouter une note à son fil. Tout le reste demande du réseau.
 */

const LEAD = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Lectures gardées pour le hors-ligne (chemins de l'API) : de quoi afficher les leads, la carte, les vagues et le calendrier. */
export const CACHED_GET = ["/me", "/leads", "/stages", "/regions", "/waves", "/tasks", "/events", "/custom-fields"] as const;
/** Lectures par lead gardées elles aussi : la fiche, son fil et ses contacts. */
export const CACHED_GET_LEAD = ["activities", "contacts"] as const;

export type Queueable = { method: string; path: string; body: unknown };

/** Ce geste peut-il attendre le retour du réseau ? Seuls « visité / étape » d'un lead et une note du fil le peuvent. */
export function isQueueable({ method, path, body }: Queueable): boolean {
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!obj) return false;
  if (method === "PATCH" && new RegExp(`^/leads/${LEAD}$`).test(path)) {
    const keys = Object.keys(obj);
    return keys.length > 0 && keys.every((k) => k === "visited" || k === "status");
  }
  if (method === "POST" && new RegExp(`^/leads/${LEAD}/activities$`).test(path)) return typeof obj.body === "string" && typeof obj.kind === "string";
  return false;
}

/** Applique à l'écran, tout de suite, un geste mis en attente (le serveur le recevra plus tard). Les notes n'ont pas d'effet ici. */
export function applyOptimistic(lead: Lead, entry: Queueable, now = new Date()): Lead {
  if (entry.method !== "PATCH") return lead;
  const b = entry.body as { visited?: boolean; status?: string };
  return {
    ...lead,
    ...(b.visited === undefined ? {} : { visitedAt: b.visited ? (lead.visitedAt ?? now.toISOString()) : null }),
    ...(b.status === undefined ? {} : { status: b.status }),
  };
}

/** Applique tous les gestes en attente à une liste de leads (celle qu'on vient de lire, qui ne les connaît pas encore). */
export function applyPending(leads: Lead[], entries: Queueable[], now = new Date()): Lead[] {
  return entries.reduce((acc, e) => {
    const id = leadIdOf(e.path);
    return id ? acc.map((l) => (l.id === id ? applyOptimistic(l, e, now) : l)) : acc;
  }, leads);
}

/** Identifiant du lead visé par un geste en attente (null pour tout autre chemin). */
export const leadIdOf = (path: string): string | null => new RegExp(`^/leads/(${LEAD})(/|$)`).exec(path)?.[1] ?? null;

export type FlushResult = { done: number; dropped: number; stoppedOffline: boolean };

/**
 * Rejoue les gestes en attente, dans l'ordre. `send` renvoie le statut HTTP, ou null si le réseau manque : on s'arrête
 * alors et on garde le reste. Un refus du serveur (4xx) abandonne ce geste (il ne réussirait jamais) mais continue.
 */
export async function replay<T extends { id?: number }>(entries: T[], send: (e: T) => Promise<number | null>, remove: (id: number) => Promise<void>): Promise<FlushResult> {
  const out: FlushResult = { done: 0, dropped: 0, stoppedOffline: false };
  for (const e of entries) {
    const status = await send(e);
    if (status === null || status >= 500) {
      out.stoppedOffline = true;
      break;
    }
    if (e.id !== undefined) await remove(e.id);
    if (status >= 200 && status < 300) out.done++;
    else out.dropped++;
  }
  return out;
}

/** Les sites côté serveur : lecture, enregistrement automatique, et reprise des anciens brouillons du navigateur. */
import { api, ApiError } from "../api";
import type { Site } from "./model";

export type Stored = { id: string; version: number; updatedAt: string; data: Omit<Site, "id" | "updatedAt"> };
export type SaveStatus = "saved" | "saving" | "error" | "conflict";

export const toSite = (s: Stored): Site => ({ ...s.data, id: s.id, updatedAt: s.updatedAt });
const toData = ({ name, variables, styles, pages }: Site) => ({ name: name.trim() || "Sans nom", variables, styles, pages });

export const listSites = () => api<Stored[]>("/cms/sites");
export const createSite = (site: Site) => api<Stored>("/cms/sites", { body: { data: toData(site) } });
export const deleteSite = (id: string) => api(`/cms/sites/${id}`, { method: "DELETE" });
export const putSite = (site: Site, version: number) => api<Stored>(`/cms/sites/${site.id}`, { method: "PUT", body: { data: toData(site), version } });

/**
 * Enregistrement différé : on attend une pause dans la saisie, un seul envoi à la fois par site, et la dernière version
 * gagne. En cas de conflit (modifié ailleurs) on s'arrête : rien n'est écrasé.
 */
export function createSaver(send: (site: Site, version: number) => Promise<{ version: number }>, onStatus: (s: SaveStatus) => void, delay = 800) {
  const versions = new Map<string, number>();
  const pending = new Map<string, Site>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let busy = false;
  let blocked = false;

  const later = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), ms);
  };
  async function flush() {
    if (busy || blocked) return;
    busy = true;
    try {
      for (const [id, site] of [...pending]) {
        const saved = await send(site, versions.get(id)!);
        versions.set(id, saved.version);
        if (pending.get(id) === site) pending.delete(id);
      }
      if (pending.size) later(delay);
      else onStatus("saved");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        blocked = true;
        onStatus("conflict");
      } else {
        onStatus("error");
        later(delay * 6); // réseau coupé : on réessaie
      }
    } finally {
      busy = false;
    }
  }
  return {
    track: (id: string, version: number) => versions.set(id, version),
    change(site: Site) {
      pending.set(site.id, site);
      if (blocked) return;
      onStatus("saving");
      later(delay);
    },
    forget(id: string) {
      pending.delete(id);
      versions.delete(id);
    },
    unsaved: () => pending.size > 0,
    flush,
  };
}

const LEGACY = "hivation.cms2.";
/** Brouillons de l'ancienne version, gardés dans ce navigateur. */
export function legacyDrafts(): { key: string; sites: Site[] }[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(LEGACY))
      .map((key) => ({ key, sites: JSON.parse(localStorage.getItem(key) ?? "[]") as Site[] }))
      .filter((d) => Array.isArray(d.sites) && d.sites.length > 0);
  } catch {
    return [];
  }
}

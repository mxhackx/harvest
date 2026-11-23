import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { leads } from "../db/schema.js";
import { locate } from "./locate.js";

const MAX_PER_BATCH = 300;
const pending = new Set<Promise<void>>();

/**
 * Cherche la position de leads sans coordonnées, un par un, sans bloquer la requête qui les a créés
 * (le service d'adresses impose au plus une recherche par seconde). Les points apparaissent sur la
 * carte au fil de l'eau ; ce qui n'est pas trouvé reste « sans position ».
 */
export function locateInBackground(leadIds: string[], region: string, onError?: (e: unknown) => void): Promise<void> {
  const task: Promise<void> = (async () => {
    for (const id of leadIds.slice(0, MAX_PER_BATCH)) {
      try {
        const [l] = await db.select().from(leads).where(eq(leads.id, id));
        if (!l || l.lat !== null) continue;
        const found = await locate({ googleMapsUrl: l.googleMapsUrl, address: l.address, city: l.city, region });
        if (found) {
          // la condition « lat IS NULL » évite d'écraser une position posée entre-temps à la main
          await db
            .update(leads)
            .set({ lat: found.lat, lng: found.lng, locationSource: found.source, updatedAt: new Date() })
            .where(and(eq(leads.id, id), isNull(leads.lat)));
        }
      } catch (e) {
        onError?.(e);
      }
    }
  })().finally(() => pending.delete(task));
  pending.add(task);
  return task;
}

/** Attend la fin des recherches en cours (utile aux tests et à l'arrêt propre du serveur). */
export const idle = () => Promise.all([...pending]).then(() => undefined);

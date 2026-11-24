import { and, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { leads } from "../db/schema.js";

/** Durée de conservation d'un lead dans la corbeille avant effacement définitif. */
export const TRASH_DAYS = 30;

/** Met des leads à la corbeille : masqués partout, restaurables, contacts et historique conservés. */
export async function trashLeads(ids: string[], userId: string) {
  if (ids.length === 0) return;
  await db.update(leads).set({ deletedAt: new Date(), deletedBy: userId }).where(inArray(leads.id, ids));
}

/** Efface pour de bon les leads restés plus de TRASH_DAYS jours dans la corbeille. Renvoie leur nombre. */
export async function purgeExpiredTrash(now = new Date()): Promise<number> {
  const limit = new Date(now.getTime() - TRASH_DAYS * 86_400_000);
  const gone = await db.delete(leads).where(and(isNotNull(leads.deletedAt), lt(leads.deletedAt, limit))).returning({ id: leads.id });
  return gone.length;
}

import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { attachments } from "../db/schema.js";
import { getStorage } from "./index.js";

/** Retire du stockage les fichiers dont le lead a été effacé, et les envois jamais terminés (plus d'un jour). */
export async function purgeAttachments(now = new Date()): Promise<number> {
  const storage = getStorage();
  if (!storage) return 0;
  const rows = await db
    .select({ id: attachments.id, path: attachments.path })
    .from(attachments)
    .where(or(isNull(attachments.leadId), and(eq(attachments.ready, false), lt(attachments.createdAt, new Date(now.getTime() - 86_400_000)))))
    .limit(500);
  if (!rows.length) return 0;
  // le fichier d'abord : si le stockage refuse, la ligne reste et sera reprise
  await storage.remove(rows.map((r) => r.path));
  await db.delete(attachments).where(inArray(attachments.id, rows.map((r) => r.id)));
  return rows.length;
}

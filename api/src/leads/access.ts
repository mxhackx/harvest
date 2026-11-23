import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { leads } from "../db/schema.js";
import { can, type Subject } from "../rbac/policy.js";

const uuid = z.string().uuid();

/** Attributs d'un lead pour les décisions de droits (portée own / team / company). */
export const leadAttrs = (l: { companyId: string; ownerId: string; teamId: string | null }) => ({
  companyId: l.companyId,
  ownerId: l.ownerId,
  teamId: l.teamId,
});

/**
 * Lead de l'entreprise que l'utilisateur a le droit de lire, sinon `null`. Hors de la portée de lecture :
 * « introuvable », jamais « interdit » (on ne révèle pas l'existence d'un lead qu'on ne voit pas).
 */
export async function findReadableLead(subject: Subject, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.companyId, subject.companyId)))
    .limit(1);
  return lead && can(subject, "lead:read", leadAttrs(lead)) ? lead : null;
}

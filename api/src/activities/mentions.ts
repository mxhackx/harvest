import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { memberships, users } from "../db/schema.js";
import { leadAttrs } from "../leads/access.js";
import { loadMembership } from "../plugins/auth.js";
import { can } from "../rbac/policy.js";

export type Mentionable = { id: string; name: string };

/** Collègues qu'on peut mentionner sur un lead : membres de l'entreprise (hors soi-même) qui ont le droit de lire ce lead. */
export async function mentionableMembers(companyId: string, selfId: string, lead: Parameters<typeof leadAttrs>[0]): Promise<Mentionable[]> {
  const people = await db
    .select({ id: users.id, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.companyId, companyId)));
  const out: Mentionable[] = [];
  for (const p of people) {
    if (p.id === selfId) continue;
    const ctx = await loadMembership(p.id, companyId);
    if (ctx && can(ctx.subject, "lead:read", leadAttrs(lead))) out.push(p);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

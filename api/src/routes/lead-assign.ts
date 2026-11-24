import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { logActivities } from "../activities/log.js";
import { db } from "../db/index.js";
import { leads, memberships, notifications, users } from "../db/schema.js";
import { alive, leadAttrs } from "../leads/access.js";
import { can } from "../rbac/policy.js";
import { requirePermission } from "../plugins/auth.js";

const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(200), ownerId: z.string().uuid() });

/**
 * Réattribue des leads à un membre. Il faut le droit `lead:assign` sur chaque lead (portée) ET le droit d'attribuer
 * à cette personne (portée de la personne) ; ce qui n'est pas lisible ou pas attribuable est ignoré, jamais révélé.
 */
export async function leadAssignRoutes(app: FastifyInstance) {
  app.post("/leads/assign", { preHandler: requirePermission("lead:assign") }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    const { subject } = req.member!;
    const [target] = await db
      .select({ userId: memberships.userId, teamId: memberships.teamId, name: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.companyId, subject.companyId), eq(memberships.userId, parsed.data.ownerId)))
      .limit(1);
    if (!target || !can(subject, "lead:assign", { companyId: subject.companyId, ownerId: target.userId, teamId: target.teamId })) {
      return reply.code(400).send({ error: "invalid_body", issues: [{ message: "personne introuvable ou non attribuable", path: ["ownerId"] }] });
    }
    const rows = await db
      .select({ lead: leads, ownerName: users.name })
      .from(leads)
      .innerJoin(users, eq(users.id, leads.ownerId))
      .where(and(eq(leads.companyId, subject.companyId), alive, inArray(leads.id, parsed.data.ids)));
    const movable = rows.filter(({ lead }) => lead.ownerId !== target.userId && can(subject, "lead:read", leadAttrs(lead)) && can(subject, "lead:assign", leadAttrs(lead)));
    if (movable.length) {
      const ids = movable.map((m) => m.lead.id);
      await db.update(leads).set({ ownerId: target.userId, teamId: target.teamId, updatedAt: new Date() }).where(inArray(leads.id, ids));
      await logActivities(
        movable.map(({ lead, ownerName }) => ({
          companyId: subject.companyId,
          leadId: lead.id,
          authorId: subject.userId,
          kind: "assigned" as const,
          meta: { from: { id: lead.ownerId, name: ownerName }, to: { id: target.userId, name: target.name } },
        })),
        (e) => req.log.error({ err: e }, "activity log failed"),
      );
      if (target.userId !== subject.userId) {
        await db.insert(notifications).values({
          companyId: subject.companyId,
          userId: target.userId,
          kind: "lead_assigned",
          title: movable.length === 1 ? `${req.user!.name} vous a attribué : ${movable[0].lead.name}` : `${req.user!.name} vous a attribué ${movable.length} leads`,
          leadId: movable.length === 1 ? movable[0].lead.id : null,
        });
      }
    }
    return { affected: movable.length };
  });
}

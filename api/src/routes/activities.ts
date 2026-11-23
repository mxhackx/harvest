import type { FastifyInstance } from "fastify";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { activities, users } from "../db/schema.js";
import { MANUAL_KINDS, isManualKind } from "../activities/log.js";
import { findReadableLead, leadAttrs } from "../leads/access.js";
import { can } from "../rbac/policy.js";
import { requirePermission } from "../plugins/auth.js";

const MAX_AHEAD_MS = 5 * 60 * 1000; // on n'enregistre pas d'actions « dans le futur » : ce sont des tâches
const date = z.string().datetime({ offset: true }).transform((v) => new Date(v));
const notFuture = (d: Date) => d.getTime() <= Date.now() + MAX_AHEAD_MS;

const createBody = z.object({
  kind: z.enum(MANUAL_KINDS),
  body: z.string().trim().min(1).max(2000),
  occurredAt: date.refine(notFuture, "la date ne peut pas être dans le futur").optional(),
});
const patchBody = z.object({
  body: z.string().trim().min(1).max(2000).optional(),
  occurredAt: date.refine(notFuture, "la date ne peut pas être dans le futur").optional(),
});
const listQuery = z.object({
  before: date.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const uuid = z.string().uuid();

export async function activityRoutes(app: FastifyInstance) {
  // Plus récent d'abord. `before` = date de la dernière entrée reçue : page suivante.
  app.get<{ Params: { id: string } }>("/leads/:id/activities", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query", issues: q.error.issues });
    const lead = await findReadableLead(req.member!.subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    const rows = await db
      .select({ activity: activities, authorName: users.name })
      .from(activities)
      .innerJoin(users, eq(users.id, activities.authorId))
      .where(and(eq(activities.leadId, lead.id), q.data.before ? lt(activities.occurredAt, q.data.before) : undefined))
      .orderBy(desc(activities.occurredAt), desc(activities.createdAt))
      .limit(q.data.limit + 1);
    const page = rows.slice(0, q.data.limit);
    return {
      items: page.map((r) => ({ ...r.activity, authorName: r.authorName })),
      // s'il reste des entrées plus anciennes, la date à passer dans `before`
      next: rows.length > q.data.limit ? page[page.length - 1].activity.occurredAt.toISOString() : null,
    };
  });

  app.post<{ Params: { id: string } }>("/leads/:id/activities", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const lead = await findReadableLead(subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", leadAttrs(lead))) return reply.code(403).send({ error: "forbidden" });
    const [created] = await db
      .insert(activities)
      .values({ companyId: subject.companyId, leadId: lead.id, authorId: subject.userId, ...body.data })
      .returning();
    const [author] = await db.select({ name: users.name }).from(users).where(eq(users.id, subject.userId));
    return reply.code(201).send({ ...created, authorName: author.name });
  });

  /** Une saisie à la main appartient à son auteur ; les événements du système ne se modifient pas. */
  async function ownManual(subject: { companyId: string; userId: string }, id: string) {
    if (!uuid.safeParse(id).success) return { status: 404 as const };
    const [a] = await db.select().from(activities).where(and(eq(activities.id, id), eq(activities.companyId, subject.companyId)));
    if (!a) return { status: 404 as const };
    return { a };
  }

  app.patch<{ Params: { id: string } }>("/activities/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ error: "invalid_body", issues: body.success ? [] : body.error.issues });
    const { subject } = req.member!;
    const found = await ownManual(subject, req.params.id);
    if ("status" in found) return reply.code(404).send({ error: "not_found" });
    // même règle de visibilité que pour le lead : ce qu'on ne peut pas lire est « introuvable »
    if (!(await findReadableLead(subject, found.a.leadId))) return reply.code(404).send({ error: "not_found" });
    if (!isManualKind(found.a.kind)) return reply.code(403).send({ error: "system_activity" });
    if (found.a.authorId !== subject.userId) return reply.code(403).send({ error: "not_author" });
    const [updated] = await db.update(activities).set(body.data).where(eq(activities.id, found.a.id)).returning();
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/activities/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const { subject } = req.member!;
    const found = await ownManual(subject, req.params.id);
    if ("status" in found) return reply.code(404).send({ error: "not_found" });
    if (!(await findReadableLead(subject, found.a.leadId))) return reply.code(404).send({ error: "not_found" });
    if (!isManualKind(found.a.kind)) return reply.code(403).send({ error: "system_activity" });
    if (found.a.authorId !== subject.userId) return reply.code(403).send({ error: "not_author" });
    await db.delete(activities).where(eq(activities.id, found.a.id));
    return reply.code(204).send();
  });
}

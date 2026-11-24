import type { FastifyInstance } from "fastify";
import { and, asc, eq, gte, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { events, leads } from "../db/schema.js";
import { can, type Subject } from "../rbac/policy.js";
import { scopeCondition } from "../rbac/sql.js";
import { requirePermission } from "../plugins/auth.js";

const KINDS = ["visit", "call", "followup", "other"] as const;
const MAX_RANGE_MS = 62 * 24 * 3600 * 1000; // deux mois : assez pour une grille de calendrier

const date = z.string().datetime({ offset: true }).transform((v) => new Date(v));

const base = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(KINDS),
  startsAt: date,
  notes: z.string().trim().max(1000),
  done: z.boolean(),
  leadId: z.string().uuid().nullable(),
});
const createBody = base.partial().required({ title: true, startsAt: true });
const patchBody = base.partial();
const rangeQuery = z.object({ from: date, to: date }).refine((r) => r.to > r.from && +r.to - +r.from <= MAX_RANGE_MS, {
  message: "période invalide (au plus 62 jours)",
});

const uuid = z.string().uuid();
const attrs = (e: { companyId: string; ownerId: string; teamId: string | null }) => ({
  companyId: e.companyId,
  ownerId: e.ownerId,
  teamId: e.teamId,
});

/** Le lead lié doit exister dans l'entreprise ET être lisible par l'utilisateur. */
async function readableLead(subject: Subject, leadId: string) {
  const [l] = await db
    .select({ id: leads.id, companyId: leads.companyId, ownerId: leads.ownerId, teamId: leads.teamId })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.companyId, subject.companyId)));
  return l && can(subject, "lead:read", attrs(l)) ? l : null;
}

async function findEvent(subject: Subject, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [e] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.companyId, subject.companyId)));
  // hors de la portée de lecture : « introuvable », pas « interdit »
  return e && can(subject, "event:read", attrs(e)) ? e : null;
}

export async function eventRoutes(app: FastifyInstance) {
  app.get("/events", { preHandler: requirePermission("event:read") }, async (req, reply) => {
    const q = rangeQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query", issues: q.error.issues });
    const { subject } = req.member!;
    const scope = scopeCondition(events, subject, "event:read")!;
    const rows = await db
      .select({
        event: events,
        lead: { name: leads.name, ownerId: leads.ownerId, teamId: leads.teamId, companyId: leads.companyId },
      })
      .from(events)
      .leftJoin(leads, eq(leads.id, events.leadId))
      .where(and(scope, or(isNull(events.leadId), isNull(leads.deletedAt)), gte(events.startsAt, q.data.from), lt(events.startsAt, q.data.to)))
      .orderBy(asc(events.startsAt))
      .limit(500);
    return rows.map(({ event, lead }) => ({
      ...event,
      // le nom du lead n'est révélé que si l'utilisateur a le droit de le lire
      leadName: lead && can(subject, "lead:read", attrs(lead)) ? lead.name : null,
    }));
  });

  app.post("/events", { preHandler: requirePermission("event:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    if (body.data.leadId && !(await readableLead(subject, body.data.leadId))) {
      return reply.code(400).send({ error: "invalid_body", issues: [{ message: "lead introuvable", path: ["leadId"] }] });
    }
    const [created] = await db
      .insert(events)
      .values({ ...body.data, companyId: subject.companyId, teamId: subject.teamId, ownerId: subject.userId })
      .returning();
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/events/:id", { preHandler: requirePermission("event:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const event = await findEvent(subject, req.params.id);
    if (!event) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "event:update", attrs(event))) return reply.code(403).send({ error: "forbidden" });
    if (body.data.leadId && !(await readableLead(subject, body.data.leadId))) {
      return reply.code(400).send({ error: "invalid_body", issues: [{ message: "lead introuvable", path: ["leadId"] }] });
    }
    const [updated] = await db
      .update(events)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(events.id, event.id))
      .returning();
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/events/:id", { preHandler: requirePermission("event:delete") }, async (req, reply) => {
    const { subject } = req.member!;
    const event = await findEvent(subject, req.params.id);
    if (!event) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "event:delete", attrs(event))) return reply.code(403).send({ error: "forbidden" });
    await db.delete(events).where(eq(events.id, event.id));
    return reply.code(204).send();
  });
}

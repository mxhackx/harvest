import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { leads } from "../db/schema.js";
import { can, listFilter, type Subject } from "../rbac/policy.js";
import { requirePermission } from "../plugins/auth.js";

const STATUSES = ["to_visit", "interested", "mockup_sent", "deposit_paid"] as const;

const base = z.object({
  name: z.string().trim().min(1).max(120),
  sector: z.string().trim().max(100),
  address: z.string().trim().max(200),
  contactName: z.string().trim().max(100),
  phone: z.string().trim().max(40),
  status: z.enum(STATUSES),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  estimatedValue: z.number().int().min(0).max(2_000_000_000).nullable(),
  visited: z.boolean(),
});
const coordsTogether = (v: { lat?: number | null; lng?: number | null }) =>
  (v.lat === undefined) === (v.lng === undefined) && (v.lat === null) === (v.lng === null);
const coordsMsg = { message: "lat et lng vont ensemble", path: ["lat"] };

const createBody = base
  .partial()
  .required({ name: true })
  .refine(coordsTogether, coordsMsg);
const patchBody = base.partial().refine(coordsTogether, coordsMsg);

const uuid = z.string().uuid();

/** Restriction SQL selon la portée du droit (own / team / company). */
function scopeWhere(subject: Subject, permission: string): SQL | null {
  const f = listFilter(subject, permission);
  const company = eq(leads.companyId, subject.companyId);
  if (f.kind === "none") return null;
  if (f.kind === "company") return company;
  if (f.kind === "own") return and(company, eq(leads.ownerId, f.userId))!;
  return and(
    company,
    f.teamId ? or(eq(leads.ownerId, f.userId), eq(leads.teamId, f.teamId)) : eq(leads.ownerId, f.userId),
  )!;
}

const attrs = (l: typeof leads.$inferSelect) => ({ companyId: l.companyId, ownerId: l.ownerId, teamId: l.teamId });

async function findLead(subject: Subject, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.companyId, subject.companyId)))
    .limit(1);
  // Hors de la portée de lecture : on répond « introuvable », pas « interdit ».
  return lead && can(subject, "lead:read", attrs(lead)) ? lead : null;
}


const bulkIds = z.array(z.string().uuid()).min(1).max(200);
const bulkUpdateBody = z
  .object({ ids: bulkIds, status: z.enum(STATUSES).optional(), visited: z.boolean().optional() })
  .refine((v) => v.status !== undefined || v.visited !== undefined, { message: "rien à modifier" });
const bulkDeleteBody = z.object({ ids: bulkIds });

/** Leads demandés, restreints à l'entreprise ; chacun doit ensuite passer `can()` pour l'action voulue. */
async function loadAllowed(subject: Subject, ids: string[], permission: string) {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.companyId, subject.companyId), inArray(leads.id, [...new Set(ids)])));
  return rows.filter((l) => can(subject, "lead:read", attrs(l)) && can(subject, permission, attrs(l)));
}

export async function leadRoutes(app: FastifyInstance) {
  app.get("/leads", { preHandler: requirePermission("lead:read") }, async (req) => {
    const where = scopeWhere(req.member!.subject, "lead:read")!;
    return db.select().from(leads).where(where).orderBy(desc(leads.createdAt)).limit(1000);
  });

  app.post("/leads", { preHandler: requirePermission("lead:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const { visited, ...data } = body.data;
    const [lead] = await db
      .insert(leads)
      .values({
        ...data,
        companyId: subject.companyId,
        teamId: subject.teamId,
        ownerId: subject.userId,
        visitedAt: visited ? new Date() : null,
      })
      .returning();
    return reply.code(201).send(lead);
  });

  // Actions de masse : on applique à ce que les droits permettent, et on dit combien ont été ignorés.
  app.post("/leads/bulk-update", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = bulkUpdateBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const allowed = await loadAllowed(subject, body.data.ids, "lead:update");
    if (allowed.length) {
      await db
        .update(leads)
        .set({
          ...(body.data.status ? { status: body.data.status } : {}),
          ...(body.data.visited === undefined
            ? {}
            : { visitedAt: body.data.visited ? sql`coalesce(${leads.visitedAt}, now())` : null }),
          updatedAt: new Date(),
        })
        .where(inArray(leads.id, allowed.map((l) => l.id)));
    }
    return { affected: allowed.length, skipped: new Set(body.data.ids).size - allowed.length };
  });

  app.post("/leads/bulk-delete", { preHandler: requirePermission("lead:delete") }, async (req, reply) => {
    const body = bulkDeleteBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const allowed = await loadAllowed(subject, body.data.ids, "lead:delete");
    if (allowed.length) await db.delete(leads).where(inArray(leads.id, allowed.map((l) => l.id)));
    return { affected: allowed.length, skipped: new Set(body.data.ids).size - allowed.length };
  });

  app.patch<{ Params: { id: string } }>("/leads/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const lead = await findLead(subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", attrs(lead))) return reply.code(403).send({ error: "forbidden" });
    const { visited, ...data } = body.data;
    const [updated] = await db
      .update(leads)
      .set({
        ...data,
        ...(visited === undefined ? {} : { visitedAt: visited ? (lead.visitedAt ?? new Date()) : null }),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id))
      .returning();
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/leads/:id", { preHandler: requirePermission("lead:delete") }, async (req, reply) => {
    const { subject } = req.member!;
    const lead = await findLead(subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:delete", attrs(lead))) return reply.code(403).send({ error: "forbidden" });
    await db.delete(leads).where(eq(leads.id, lead.id));
    return reply.code(204).send();
  });
}

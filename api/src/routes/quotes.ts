import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { activities, leads, quotes } from "../db/schema.js";
import { findReadableLead, leadAttrs } from "../leads/access.js";
import { canTransition, computeTotals, nextNumber, type Status } from "../quotes/compute.js";
import { can } from "../rbac/policy.js";
import { requirePermission } from "../plugins/auth.js";

const uuid = z.string().uuid();
const line = z.object({
  label: z.string().trim().min(1).max(200),
  // jusqu'à 2 décimales (2,5 heures)
  quantity: z.number().positive().max(1_000_000).refine((q) => Math.abs(q * 100 - Math.round(q * 100)) < 1e-6, "2 décimales au plus"),
  unitPrice: z.number().int().min(0).max(2_000_000_000),
});
const fields = z.object({
  title: z.string().trim().min(1).max(150),
  lines: z.array(line).max(50),
  taxRate: z.number().int().min(0).max(100),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: z.string().trim().max(2000),
});
const createBody = fields.partial().required({ title: true });
const patchBody = fields.partial();
const statusBody = z.object({ status: z.enum(["sent", "accepted", "declined"]) });

const present = (q: typeof quotes.$inferSelect) => ({ ...q, ...computeTotals(q.lines, q.taxRate) });
const fmt = (n: number) => n.toLocaleString("fr-FR");

/** Devis : rattachés à un lead (une opportunité) ; on les lit et on les écrit avec les droits sur ce lead. */
export async function quoteRoutes(app: FastifyInstance) {
  type LeadRow = NonNullable<Awaited<ReturnType<typeof findReadableLead>>>;
  type Found = { ok: true; lead: LeadRow } | { ok: false; fail: 404 | 403 };
  async function leadFor(subject: Parameters<typeof findReadableLead>[0], id: string, write: boolean): Promise<Found> {
    const lead = await findReadableLead(subject, id);
    if (!lead) return { ok: false, fail: 404 };
    if (write && !can(subject, "lead:update", leadAttrs(lead))) return { ok: false, fail: 403 };
    return { ok: true, lead };
  }
  async function findQuote(companyId: string, id: string) {
    if (!uuid.safeParse(id).success) return null;
    const [q] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.companyId, companyId)));
    return q ?? null;
  }

  app.get<{ Params: { id: string } }>("/leads/:id/quotes", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const found = await leadFor(req.member!.subject, req.params.id, false);
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    return (await db.select().from(quotes).where(eq(quotes.leadId, found.lead.id)).orderBy(desc(quotes.createdAt))).map(present);
  });

  app.post<{ Params: { id: string } }>("/leads/:id/quotes", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const found = await leadFor(subject, req.params.id, true);
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    const created = await db.transaction(async (tx) => {
      // un verrou par entreprise et par année : deux devis créés en même temps n'ont jamais le même numéro
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`quote:${subject.companyId}`}))`);
      const numbers = (await tx.select({ n: quotes.number }).from(quotes).where(eq(quotes.companyId, subject.companyId))).map((r) => r.n);
      const [q] = await tx
        .insert(quotes)
        .values({ ...body.data, companyId: subject.companyId, leadId: found.lead.id, number: nextNumber(numbers), createdBy: subject.userId })
        .returning();
      return q;
    });
    req.auditLabel = `${created.number} · ${found.lead.name}`;
    return reply.code(201).send(present(created));
  });

  app.get<{ Params: { id: string } }>("/quotes/:id", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const { subject } = req.member!;
    const q = await findQuote(subject.companyId, req.params.id);
    if (!q || !(await findReadableLead(subject, q.leadId))) return reply.code(404).send({ error: "not_found" });
    const [lead] = await db.select({ name: leads.name }).from(leads).where(eq(leads.id, q.leadId));
    return { ...present(q), leadName: lead?.name ?? "" };
  });

  // Modifier : seulement tant que c'est un brouillon.
  app.patch<{ Params: { id: string } }>("/quotes/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const q = await findQuote(subject.companyId, req.params.id);
    const found = q ? await leadFor(subject, q.leadId, true) : null;
    if (!q || !found) return reply.code(404).send({ error: "not_found" });
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    if (q.status !== "draft") return reply.code(409).send({ error: "quote_locked" });
    const [updated] = await db.update(quotes).set({ ...body.data, updatedAt: new Date() }).where(eq(quotes.id, q.id)).returning();
    req.auditLabel = updated.number;
    return present(updated);
  });

  app.delete<{ Params: { id: string } }>("/quotes/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const { subject } = req.member!;
    const q = await findQuote(subject.companyId, req.params.id);
    const found = q ? await leadFor(subject, q.leadId, true) : null;
    if (!q || !found) return reply.code(404).send({ error: "not_found" });
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    if (q.status !== "draft") return reply.code(409).send({ error: "quote_locked" }); // un devis envoyé garde sa trace
    await db.delete(quotes).where(eq(quotes.id, q.id));
    req.auditLabel = q.number;
    return reply.code(204).send();
  });

  // Faire avancer un devis : envoyé, puis accepté ou refusé. L'acceptation met la valeur du lead au montant du devis.
  app.post<{ Params: { id: string } }>("/quotes/:id/status", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = statusBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const q = await findQuote(subject.companyId, req.params.id);
    const found = q ? await leadFor(subject, q.leadId, true) : null;
    if (!q || !found) return reply.code(404).send({ error: "not_found" });
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    const to = body.data.status;
    if (!canTransition(q.status as Status, to)) return reply.code(409).send({ error: "quote_transition" });
    const totals = computeTotals(q.lines, q.taxRate);
    if (to === "sent" && q.lines.length === 0) return reply.code(409).send({ error: "quote_empty" });
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const [u] = await tx
        .update(quotes)
        .set({ status: to, updatedAt: now, ...(to === "sent" ? { sentAt: now } : { decidedAt: now }) })
        .where(eq(quotes.id, q.id))
        .returning();
      if (to === "accepted" && totals.total > 0) await tx.update(leads).set({ estimatedValue: Math.min(totals.total, 2_000_000_000), updatedAt: now }).where(eq(leads.id, q.leadId));
      const text = { sent: `Devis ${q.number} envoyé (${fmt(totals.total)})`, accepted: `Devis ${q.number} accepté (${fmt(totals.total)})`, declined: `Devis ${q.number} refusé` }[to];
      await tx.insert(activities).values({ companyId: subject.companyId, leadId: q.leadId, authorId: subject.userId, kind: "note", body: text });
      return u;
    });
    req.auditLabel = `${updated.number} → ${to}`;
    return present(updated);
  });
}

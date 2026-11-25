import type { FastifyInstance } from "fastify";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { activities, invoices, leads, quotes } from "../db/schema.js";
import { alive, findReadableLead, leadAttrs } from "../leads/access.js";
import { computeTotals, nextNumber } from "../quotes/compute.js";
import { can } from "../rbac/policy.js";
import { requirePermission } from "../plugins/auth.js";
import { scopeCondition } from "../rbac/sql.js";

const uuid = z.string().uuid();
const line = z.object({
  label: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(1_000_000).refine((q) => Math.abs(q * 100 - Math.round(q * 100)) < 1e-6, "2 décimales au plus"),
  unitPrice: z.number().int().min(0).max(2_000_000_000),
});
const fields = z.object({
  title: z.string().trim().min(1).max(150),
  lines: z.array(line).max(50),
  taxRate: z.number().int().min(0).max(100),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: z.string().trim().max(2000),
});
const createBody = fields.partial().required({ title: true });
const patchBody = fields.partial();
const statusBody = z.object({ status: z.enum(["sent", "paid", "cancelled"]) });

type Status = "draft" | "sent" | "paid" | "cancelled";
const NEXT: Record<Status, Status[]> = { draft: ["sent", "cancelled"], sent: ["paid", "cancelled"], paid: [], cancelled: [] };
const present = (i: typeof invoices.$inferSelect) => ({ ...i, ...computeTotals(i.lines, i.taxRate) });
const fmt = (n: number) => n.toLocaleString("fr-FR");

/** Factures : tirées d'un devis accepté ou saisies à la main ; brouillon → envoyée → payée (ou annulée). Droits : ceux du lead. */
export async function invoiceRoutes(app: FastifyInstance) {
  type LeadRow = NonNullable<Awaited<ReturnType<typeof findReadableLead>>>;
  type Found = { ok: true; lead: LeadRow } | { ok: false; fail: 404 | 403 };
  async function leadFor(subject: Parameters<typeof findReadableLead>[0], id: string, write: boolean): Promise<Found> {
    const lead = await findReadableLead(subject, id);
    if (!lead) return { ok: false, fail: 404 };
    if (write && !can(subject, "lead:update", leadAttrs(lead))) return { ok: false, fail: 403 };
    return { ok: true, lead };
  }
  async function find(companyId: string, id: string) {
    if (!uuid.safeParse(id).success) return null;
    const [i] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.companyId, companyId)));
    return i ?? null;
  }
  async function create(subject: { companyId: string; userId: string }, leadId: string, values: Partial<typeof invoices.$inferInsert> & { title: string }) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`invoice:${subject.companyId}`}))`);
      const numbers = (await tx.select({ n: invoices.number }).from(invoices).where(eq(invoices.companyId, subject.companyId))).map((r) => r.n);
      const [row] = await tx.insert(invoices).values({ ...values, companyId: subject.companyId, leadId, number: nextNumber(numbers, new Date(), "F"), createdBy: subject.userId }).returning();
      return row;
    });
  }

  // Toutes les factures que la personne peut lire, avec ce qui reste à encaisser.
  app.get("/invoices", { preHandler: requirePermission("lead:read") }, async (req) => {
    const { subject } = req.member!;
    const scope = scopeCondition(leads, subject, "lead:read");
    if (!scope) return { items: [], outstanding: 0 };
    const rows = await db
      .select({ invoice: invoices, lead: leads.name })
      .from(invoices)
      .innerJoin(leads, eq(leads.id, invoices.leadId))
      .where(and(scope, alive, eq(invoices.companyId, subject.companyId)))
      .orderBy(desc(invoices.createdAt))
      .limit(500);
    const items = rows.map((r) => ({ ...present(r.invoice), leadName: r.lead }));
    return { items, outstanding: items.filter((i) => i.status === "sent").reduce((s, i) => s + i.total, 0) };
  });

  app.get<{ Params: { id: string } }>("/leads/:id/invoices", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const found = await leadFor(req.member!.subject, req.params.id, false);
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    return (await db.select().from(invoices).where(eq(invoices.leadId, found.lead.id)).orderBy(desc(invoices.createdAt))).map(present);
  });

  app.post<{ Params: { id: string } }>("/leads/:id/invoices", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const found = await leadFor(subject, req.params.id, true);
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    const created = await create(subject, found.lead.id, body.data);
    req.auditLabel = `${created.number} · ${found.lead.name}`;
    return reply.code(201).send(present(created));
  });

  // Une facture en brouillon à partir d'un devis accepté (lignes et taxe copiées) ; une seule facture active par devis.
  app.post<{ Params: { id: string } }>("/quotes/:id/invoice", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const { subject } = req.member!;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [q] = await db.select().from(quotes).where(and(eq(quotes.id, req.params.id), eq(quotes.companyId, subject.companyId)));
    const found = q ? await leadFor(subject, q.leadId, true) : null;
    if (!q || !found) return reply.code(404).send({ error: "not_found" });
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    if (q.status !== "accepted") return reply.code(409).send({ error: "quote_not_accepted" });
    const [existing] = await db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.quoteId, q.id), ne(invoices.status, "cancelled")));
    if (existing) return reply.code(409).send({ error: "invoice_exists" });
    const created = await create(subject, q.leadId, { title: q.title, lines: q.lines, taxRate: q.taxRate, notes: q.notes, quoteId: q.id });
    req.auditLabel = `${created.number} ← ${q.number}`;
    return reply.code(201).send(present(created));
  });

  app.get<{ Params: { id: string } }>("/invoices/:id", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const { subject } = req.member!;
    const i = await find(subject.companyId, req.params.id);
    if (!i || !(await findReadableLead(subject, i.leadId))) return reply.code(404).send({ error: "not_found" });
    const [lead] = await db.select({ name: leads.name }).from(leads).where(eq(leads.id, i.leadId));
    return { ...present(i), leadName: lead?.name ?? "" };
  });

  app.patch<{ Params: { id: string } }>("/invoices/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const i = await find(subject.companyId, req.params.id);
    const found = i ? await leadFor(subject, i.leadId, true) : null;
    if (!i || !found) return reply.code(404).send({ error: "not_found" });
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    if (i.status !== "draft") return reply.code(409).send({ error: "invoice_locked" });
    const [updated] = await db.update(invoices).set({ ...body.data, updatedAt: new Date() }).where(eq(invoices.id, i.id)).returning();
    req.auditLabel = updated.number;
    return present(updated);
  });

  app.delete<{ Params: { id: string } }>("/invoices/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const { subject } = req.member!;
    const i = await find(subject.companyId, req.params.id);
    const found = i ? await leadFor(subject, i.leadId, true) : null;
    if (!i || !found) return reply.code(404).send({ error: "not_found" });
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    if (i.status !== "draft") return reply.code(409).send({ error: "invoice_locked" }); // une facture émise garde sa trace (on l'annule)
    await db.delete(invoices).where(eq(invoices.id, i.id));
    req.auditLabel = i.number;
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/invoices/:id/status", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = statusBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const i = await find(subject.companyId, req.params.id);
    const found = i ? await leadFor(subject, i.leadId, true) : null;
    if (!i || !found) return reply.code(404).send({ error: "not_found" });
    if (!found.ok) return reply.code(found.fail).send({ error: found.fail === 404 ? "not_found" : "forbidden" });
    const to = body.data.status;
    if (!NEXT[i.status as Status].includes(to)) return reply.code(409).send({ error: "invoice_transition" });
    if (to === "sent" && i.lines.length === 0) return reply.code(409).send({ error: "quote_empty" });
    const total = computeTotals(i.lines, i.taxRate).total;
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const [u] = await tx.update(invoices).set({ status: to, updatedAt: now, ...(to === "sent" ? { sentAt: now } : {}), ...(to === "paid" ? { paidAt: now } : {}) }).where(eq(invoices.id, i.id)).returning();
      const text = { sent: `Facture ${i.number} envoyée (${fmt(total)})`, paid: `Facture ${i.number} payée (${fmt(total)})`, cancelled: `Facture ${i.number} annulée` }[to];
      await tx.insert(activities).values({ companyId: subject.companyId, leadId: i.leadId, authorId: subject.userId, kind: "note", body: text });
      return u;
    });
    req.auditLabel = `${updated.number} → ${to}`;
    return present(updated);
  });
}

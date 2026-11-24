import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { leads, memberships, notifications, ticketComments, tickets, users } from "../db/schema.js";
import { findReadableLead } from "../leads/access.js";
import { requirePermission } from "../plugins/auth.js";

const uuid = z.string().uuid();
const STATUS = ["open", "in_progress", "resolved", "closed"] as const;
const PRIORITY = ["low", "normal", "high", "urgent"] as const;
const fields = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000),
  leadId: uuid.nullable(),
  priority: z.enum(PRIORITY),
  assigneeId: uuid.nullable(),
  status: z.enum(STATUS),
});
const createBody = fields.pick({ title: true, description: true, leadId: true, priority: true, assigneeId: true }).partial().required({ title: true });
const patchBody = fields.partial();
const commentBody = z.object({ body: z.string().trim().min(1).max(3000) });
const listQuery = z.object({ status: z.enum([...STATUS, "active"]).optional(), mine: z.enum(["1"]).optional() });

/** Tickets : demandes et réclamations des clients après la vente, de l'ouverture à la résolution, avec leur fil de commentaires. */
export async function ticketRoutes(app: FastifyInstance) {
  async function assigneeOk(companyId: string, userId: string) {
    const [m] = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.companyId, companyId), eq(memberships.userId, userId)));
    return !!m;
  }
  async function find(companyId: string, id: string) {
    if (!uuid.safeParse(id).success) return null;
    const [t] = await db.select().from(tickets).where(and(eq(tickets.id, id), eq(tickets.companyId, companyId)));
    return t ?? null;
  }

  app.get("/tickets", { preHandler: requirePermission("ticket:read") }, async (req, reply) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query", issues: q.error.issues });
    const { subject } = req.member!;
    const rows = await db
      .select({ ticket: tickets, leadName: leads.name, assigneeName: users.name })
      .from(tickets)
      .leftJoin(leads, eq(leads.id, tickets.leadId))
      .leftJoin(users, eq(users.id, tickets.assigneeId))
      .where(and(eq(tickets.companyId, subject.companyId), q.data.mine ? eq(tickets.assigneeId, subject.userId) : undefined))
      .orderBy(desc(tickets.createdAt))
      .limit(500);
    const wanted = (s: string) => (q.data.status === undefined ? true : q.data.status === "active" ? s === "open" || s === "in_progress" : s === q.data.status);
    return rows.filter((r) => wanted(r.ticket.status)).map((r) => ({ ...r.ticket, leadName: r.leadName, assigneeName: r.assigneeName }));
  });

  app.post("/tickets", { preHandler: requirePermission("ticket:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    if (body.data.leadId && !(await findReadableLead(subject, body.data.leadId))) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "client introuvable", path: ["leadId"] }] });
    if (body.data.assigneeId && !(await assigneeOk(subject.companyId, body.data.assigneeId))) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "personne introuvable", path: ["assigneeId"] }] });
    const [created] = await db.insert(tickets).values({ ...body.data, companyId: subject.companyId, createdBy: subject.userId }).returning();
    if (created.assigneeId && created.assigneeId !== subject.userId) {
      await db.insert(notifications).values({ companyId: subject.companyId, userId: created.assigneeId, kind: "ticket_assigned", title: `Ticket à traiter : ${created.title}`, leadId: created.leadId });
    }
    req.auditLabel = created.title;
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string } }>("/tickets/:id", { preHandler: requirePermission("ticket:read") }, async (req, reply) => {
    const t = await find(req.member!.subject.companyId, req.params.id);
    if (!t) return reply.code(404).send({ error: "not_found" });
    const comments = await db
      .select({ id: ticketComments.id, body: ticketComments.body, createdAt: ticketComments.createdAt, authorName: users.name })
      .from(ticketComments)
      .leftJoin(users, eq(users.id, ticketComments.authorId))
      .where(eq(ticketComments.ticketId, t.id))
      .orderBy(asc(ticketComments.createdAt));
    const [lead] = t.leadId ? await db.select({ name: leads.name }).from(leads).where(eq(leads.id, t.leadId)) : [];
    const [assignee] = t.assigneeId ? await db.select({ name: users.name }).from(users).where(eq(users.id, t.assigneeId)) : [];
    return { ...t, leadName: lead?.name ?? null, assigneeName: assignee?.name ?? null, comments };
  });

  app.patch<{ Params: { id: string } }>("/tickets/:id", { preHandler: requirePermission("ticket:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ error: "invalid_body", issues: body.success ? [] : body.error.issues });
    const { subject } = req.member!;
    const t = await find(subject.companyId, req.params.id);
    if (!t) return reply.code(404).send({ error: "not_found" });
    if (body.data.leadId && !(await findReadableLead(subject, body.data.leadId))) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "client introuvable", path: ["leadId"] }] });
    if (body.data.assigneeId && !(await assigneeOk(subject.companyId, body.data.assigneeId))) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "personne introuvable", path: ["assigneeId"] }] });
    const resolving = body.data.status && (body.data.status === "resolved" || body.data.status === "closed");
    const [updated] = await db
      .update(tickets)
      .set({ ...body.data, updatedAt: new Date(), ...(body.data.status ? { resolvedAt: resolving ? (t.resolvedAt ?? new Date()) : null } : {}) })
      .where(eq(tickets.id, t.id))
      .returning();
    if (body.data.assigneeId && body.data.assigneeId !== t.assigneeId && body.data.assigneeId !== subject.userId) {
      await db.insert(notifications).values({ companyId: subject.companyId, userId: body.data.assigneeId, kind: "ticket_assigned", title: `Ticket à traiter : ${updated.title}`, leadId: updated.leadId });
    }
    req.auditLabel = updated.title;
    return updated;
  });

  app.post<{ Params: { id: string } }>("/tickets/:id/comments", { preHandler: requirePermission("ticket:update") }, async (req, reply) => {
    const body = commentBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const t = await find(subject.companyId, req.params.id);
    if (!t) return reply.code(404).send({ error: "not_found" });
    const [c] = await db.insert(ticketComments).values({ ticketId: t.id, authorId: subject.userId, body: body.data.body }).returning();
    await db.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, t.id));
    return reply.code(201).send(c);
  });

  app.delete<{ Params: { id: string } }>("/tickets/:id", { preHandler: requirePermission("ticket:delete") }, async (req, reply) => {
    const t = await find(req.member!.subject.companyId, req.params.id);
    if (!t) return reply.code(404).send({ error: "not_found" });
    await db.delete(tickets).where(eq(tickets.id, t.id));
    req.auditLabel = t.title;
    return reply.code(204).send();
  });
}

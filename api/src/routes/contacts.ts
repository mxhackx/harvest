import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { contacts, leads } from "../db/schema.js";
import { findReadableLead, leadAttrs } from "../leads/access.js";
import { whatsappField } from "../leads/fields.js";
import { can } from "../rbac/policy.js";
import { scopeCondition } from "../rbac/sql.js";
import { requirePermission } from "../plugins/auth.js";

const email = z
  .string()
  .trim()
  .max(254)
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "adresse e-mail invalide");

const base = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().max(100),
  phone: z.string().trim().max(40),
  whatsapp: whatsappField,
  email,
  notes: z.string().trim().max(500),
  isPrimary: z.boolean(),
});
const createBody = base.partial().required({ name: true });
const patchBody = base.partial();

const uuid = z.string().uuid();

const listQuery = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
/** « 50% » doit chercher « 50% », pas « 50 suivi de n'importe quoi » : on neutralise les jokers LIKE. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** `leads.contactName` reste le nom du contact principal : listes, import et export continuent de s'en servir. */
export async function syncLeadContactName(leadId: string) {
  const [primary] = await db.select({ name: contacts.name }).from(contacts).where(and(eq(contacts.leadId, leadId), eq(contacts.isPrimary, true)));
  await db.update(leads).set({ contactName: primary?.name ?? "" }).where(eq(leads.id, leadId));
}

/** Pour la saisie d'un nom de contact sur la fiche lead : crée le contact principal ou renomme l'existant. */
export async function ensurePrimaryContact(leadId: string, companyId: string, name: string) {
  const [primary] = await db.select().from(contacts).where(and(eq(contacts.leadId, leadId), eq(contacts.isPrimary, true)));
  if (primary) {
    if (primary.name !== name) await db.update(contacts).set({ name, updatedAt: new Date() }).where(eq(contacts.id, primary.id));
  } else {
    await db.insert(contacts).values({ leadId, companyId, name, isPrimary: true });
  }
}

async function makePrimary(leadId: string, contactId: string) {
  // l'ordre compte : l'index unique n'admet qu'un principal à la fois
  await db.update(contacts).set({ isPrimary: false }).where(and(eq(contacts.leadId, leadId), ne(contacts.id, contactId), eq(contacts.isPrimary, true)));
  await db.update(contacts).set({ isPrimary: true, updatedAt: new Date() }).where(eq(contacts.id, contactId));
}

export async function contactRoutes(app: FastifyInstance) {
  // Toutes les personnes de tous les leads que l'utilisateur peut lire (même portée que les leads), avec recherche.
  app.get("/contacts", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query", issues: q.error.issues });
    const { subject } = req.member!;
    const term = q.data.q ? `%${likeEscape(q.data.q)}%` : null;
    const where = and(
      scopeCondition(leads, subject, "lead:read")!,
      term ? or(ilike(contacts.name, term), ilike(contacts.role, term), ilike(contacts.phone, term), ilike(contacts.whatsapp, term), ilike(contacts.email, term), ilike(leads.name, term)) : undefined,
    );
    const [items, [{ total }]] = await Promise.all([
      db
        .select({ contact: contacts, leadName: leads.name })
        .from(contacts)
        .innerJoin(leads, eq(leads.id, contacts.leadId))
        .where(where)
        .orderBy(asc(contacts.name), asc(contacts.id))
        .limit(q.data.limit)
        .offset(q.data.offset),
      db.select({ total: sql<number>`count(*)::int` }).from(contacts).innerJoin(leads, eq(leads.id, contacts.leadId)).where(where),
    ]);
    return { items: items.map((r) => ({ ...r.contact, leadName: r.leadName })), total };
  });

  app.get<{ Params: { id: string } }>("/leads/:id/contacts", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const lead = await findReadableLead(req.member!.subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    return db.select().from(contacts).where(eq(contacts.leadId, lead.id)).orderBy(desc(contacts.isPrimary), asc(contacts.createdAt));
  });

  app.post<{ Params: { id: string } }>("/leads/:id/contacts", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const lead = await findReadableLead(subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", leadAttrs(lead))) return reply.code(403).send({ error: "forbidden" });
    const existing = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.leadId, lead.id));
    if (existing.length >= 30) return reply.code(409).send({ error: "too_many_contacts" });
    const { isPrimary, ...data } = body.data;
    // le premier contact d'un lead est toujours le principal
    const [created] = await db.insert(contacts).values({ ...data, leadId: lead.id, companyId: subject.companyId, isPrimary: false }).returning();
    if (isPrimary || existing.length === 0) await makePrimary(lead.id, created.id);
    await syncLeadContactName(lead.id);
    const [fresh] = await db.select().from(contacts).where(eq(contacts.id, created.id));
    return reply.code(201).send(fresh);
  });

  app.patch<{ Params: { id: string } }>("/contacts/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const found = await findContact(subject, req.params.id);
    if (!found) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", leadAttrs(found.lead))) return reply.code(403).send({ error: "forbidden" });
    const { isPrimary, ...data } = body.data;
    // un lead qui a des contacts en a toujours un principal : on en change en en désignant un autre
    if (isPrimary === false && found.contact.isPrimary) return reply.code(409).send({ error: "primary_required" });
    if (Object.keys(data).length) await db.update(contacts).set({ ...data, updatedAt: new Date() }).where(eq(contacts.id, found.contact.id));
    if (isPrimary === true) await makePrimary(found.lead.id, found.contact.id);
    await syncLeadContactName(found.lead.id);
    const [fresh] = await db.select().from(contacts).where(eq(contacts.id, found.contact.id));
    return fresh;
  });

  app.delete<{ Params: { id: string } }>("/contacts/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const { subject } = req.member!;
    const found = await findContact(subject, req.params.id);
    if (!found) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", leadAttrs(found.lead))) return reply.code(403).send({ error: "forbidden" });
    await db.delete(contacts).where(eq(contacts.id, found.contact.id));
    if (found.contact.isPrimary) {
      // le plus ancien des contacts restants devient le principal
      const [next] = await db.select().from(contacts).where(eq(contacts.leadId, found.lead.id)).orderBy(asc(contacts.createdAt)).limit(1);
      if (next) await makePrimary(found.lead.id, next.id);
    }
    await syncLeadContactName(found.lead.id);
    return reply.code(204).send();
  });

  async function findContact(subject: Parameters<typeof findReadableLead>[0], id: string) {
    if (!uuid.safeParse(id).success) return null;
    const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.companyId, subject.companyId)));
    if (!contact) return null;
    const lead = await findReadableLead(subject, contact.leadId);
    return lead ? { contact, lead } : null;
  }
}

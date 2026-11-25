import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { accounts, contacts, emailLog, leads, users } from "../db/schema.js";
import { alive, findReadableLead, leadAttrs } from "../leads/access.js";
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
  // soit « name » (ancien format : tout le nom), soit prénom et nom (le nom est alors obligatoire)
  name: z.string().trim().min(1).max(100),
  salutation: z.string().trim().max(20),
  firstName: z.string().trim().max(60),
  lastName: z.string().trim().max(60),
  reportsToId: z.string().uuid().nullable(),
  country: z.string().trim().max(60),
  street: z.string().trim().max(200),
  city: z.string().trim().max(100),
  region: z.string().trim().max(100),
  postalCode: z.string().trim().max(20),
  role: z.string().trim().max(100),
  phone: z.string().trim().max(40),
  whatsapp: whatsappField,
  email,
  notes: z.string().trim().max(500),
  isPrimary: z.boolean(),
});
const createBody = base.partial().refine((v) => !!(v.name?.trim() || v.lastName?.trim()), { message: "le nom est obligatoire", path: ["lastName"] });
const patchBody = base.partial();

/**
 * Le nom affiché (« prénom nom ») et ses deux morceaux restent cohérents : si on donne prénom et nom, `name` en découle ;
 * si on ne donne que `name` (ancien format), il devient le nom de famille.
 */
export function withNames<T extends { name?: string; firstName?: string; lastName?: string }>(data: T, current?: { firstName: string; lastName: string; name: string }): T & { name?: string; firstName?: string; lastName?: string } {
  if (data.firstName === undefined && data.lastName === undefined) {
    if (data.name === undefined) return data;
    return { ...data, firstName: "", lastName: data.name };
  }
  const firstName = data.firstName ?? current?.firstName ?? "";
  const lastName = data.lastName ?? current?.lastName ?? "";
  return { ...data, firstName, lastName, name: `${firstName} ${lastName}`.trim() || current?.name || "" };
}

const uuid = z.string().uuid();

const listQuery = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
/** « 50% » doit chercher « 50% », pas « 50 suivi de n'importe quoi » : on neutralise les jokers LIKE. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * Efface les données d'une personne gardées ailleurs que dans sa fiche contact (point d'extension : e-mails envoyés…).
 * Le texte libre des notes du fil n'est pas analysé : il se relit à la main.
 */
export async function eraseContactData(contact: typeof contacts.$inferSelect): Promise<void> {
  const byContact = eq(emailLog.contactId, contact.id);
  await db.delete(emailLog).where(contact.email ? and(eq(emailLog.leadId, contact.leadId), or(byContact, eq(emailLog.toEmail, contact.email.toLowerCase()))) : byContact);
}

/** Le supérieur d'un contact est une autre personne du même lead. */
async function sameLeadContact(leadId: string, contactId: string) {
  const [c] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.leadId, leadId)));
  return !!c;
}

/** `leads.contactName` reste le nom du contact principal : listes, import et export continuent de s'en servir. */
export async function syncLeadContactName(leadId: string) {
  const [primary] = await db.select({ name: contacts.name }).from(contacts).where(and(eq(contacts.leadId, leadId), eq(contacts.isPrimary, true)));
  await db.update(leads).set({ contactName: primary?.name ?? "" }).where(eq(leads.id, leadId));
}

/** Pour la saisie d'un nom de contact sur la fiche lead : crée le contact principal ou renomme l'existant. */
export async function ensurePrimaryContact(leadId: string, companyId: string, name: string) {
  const [primary] = await db.select().from(contacts).where(and(eq(contacts.leadId, leadId), eq(contacts.isPrimary, true)));
  if (primary) {
    if (primary.name !== name) await db.update(contacts).set({ name, firstName: "", lastName: name, updatedAt: new Date() }).where(eq(contacts.id, primary.id));
  } else {
    await db.insert(contacts).values({ leadId, companyId, name, lastName: name, isPrimary: true });
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
      alive,
      term ? or(ilike(contacts.name, term), ilike(contacts.role, term), ilike(contacts.phone, term), ilike(contacts.whatsapp, term), ilike(contacts.email, term), ilike(leads.name, term)) : undefined,
    );
    const [items, [{ total }]] = await Promise.all([
      db
        .select({ contact: contacts, leadName: leads.name, accountId: leads.accountId, accountName: accounts.name, ownerName: users.name })
        .from(contacts)
        .innerJoin(leads, eq(leads.id, contacts.leadId))
        .leftJoin(accounts, eq(accounts.id, leads.accountId))
        .leftJoin(users, eq(users.id, contacts.ownerId))
        .where(where)
        .orderBy(asc(contacts.name), asc(contacts.id))
        .limit(q.data.limit)
        .offset(q.data.offset),
      db.select({ total: sql<number>`count(*)::int` }).from(contacts).innerJoin(leads, eq(leads.id, contacts.leadId)).where(where),
    ]);
    return { items: items.map((r) => ({ ...r.contact, leadName: r.leadName, accountId: r.accountId, accountName: r.accountName, ownerName: r.ownerName })), total };
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
    if (data.reportsToId && !(await sameLeadContact(lead.id, data.reportsToId))) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "supérieur introuvable", path: ["reportsToId"] }] });
    const [created] = await db.insert(contacts).values({ ...withNames(data), leadId: lead.id, companyId: subject.companyId, ownerId: subject.userId, isPrimary: false } as typeof contacts.$inferInsert).returning();
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
    if (data.reportsToId && (data.reportsToId === found.contact.id || !(await sameLeadContact(found.lead.id, data.reportsToId)))) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "supérieur invalide", path: ["reportsToId"] }] });
    if (Object.keys(data).length) await db.update(contacts).set({ ...withNames(data, found.contact), updatedAt: new Date() }).where(eq(contacts.id, found.contact.id));
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

  // RGPD — droit d'accès : toutes les données gardées sur une personne, en JSON.
  app.get<{ Params: { id: string } }>("/contacts/:id/export", { preHandler: requirePermission("lead:export") }, async (req, reply) => {
    const { subject } = req.member!;
    const found = await findContact(subject, req.params.id);
    if (!found) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:export", leadAttrs(found.lead))) return reply.code(403).send({ error: "forbidden" });
    const { contact, lead } = found;
    req.auditLabel = contact.name;
    const emails = await db
      .select({ to: emailLog.toEmail, subject: emailLog.subject, body: emailLog.body, status: emailLog.status, sentAt: emailLog.createdAt })
      .from(emailLog)
      .where(and(eq(emailLog.leadId, lead.id), contact.email ? or(eq(emailLog.contactId, contact.id), eq(emailLog.toEmail, contact.email.toLowerCase())) : eq(emailLog.contactId, contact.id)));
    reply.header("content-disposition", `attachment; filename="contact-${contact.id}.json"`);
    return {
      exportedAt: new Date().toISOString(),
      contact: { name: contact.name, role: contact.role, phone: contact.phone, whatsapp: contact.whatsapp, email: contact.email, notes: contact.notes, isPrimary: contact.isPrimary, createdAt: contact.createdAt },
      lead: { id: lead.id, name: lead.name, city: lead.city },
      emails,
    };
  });

  // RGPD — droit à l'effacement : la personne disparaît (et son nom du lead). Irréversible, donc une confirmation explicite.
  app.post<{ Params: { id: string } }>("/contacts/:id/erase", { preHandler: requirePermission("lead:delete") }, async (req, reply) => {
    if ((req.body as { confirm?: unknown } | null)?.confirm !== true) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "confirmation requise", path: ["confirm"] }] });
    const { subject } = req.member!;
    const found = await findContact(subject, req.params.id);
    if (!found) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:delete", leadAttrs(found.lead))) return reply.code(403).send({ error: "forbidden" });
    await eraseContactData(found.contact);
    await db.delete(contacts).where(eq(contacts.id, found.contact.id));
    if (found.contact.isPrimary) {
      const [next] = await db.select().from(contacts).where(eq(contacts.leadId, found.lead.id)).orderBy(asc(contacts.createdAt)).limit(1);
      if (next) await makePrimary(found.lead.id, next.id);
    }
    await syncLeadContactName(found.lead.id);
    req.auditLabel = "contact effacé (RGPD)"; // le nom n'est volontairement pas gardé dans le journal
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

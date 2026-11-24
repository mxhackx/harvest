import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { accounts, leads } from "../db/schema.js";
import { alive, findReadableLead, leadAttrs } from "../leads/access.js";
import { can } from "../rbac/policy.js";
import { requireMember, requirePermission } from "../plugins/auth.js";
import { scopeCondition } from "../rbac/sql.js";
import { listStages } from "../stages/store.js";

const uuid = z.string().uuid();
const fields = z.object({
  name: z.string().trim().min(1).max(120),
  sector: z.string().trim().max(100),
  website: z.string().trim().max(200),
  notes: z.string().trim().max(2000),
});
const createBody = fields.partial().required({ name: true });
const patchBody = fields.partial();

/** Chiffres d'un compte d'après les opportunités que la personne peut lire : leur nombre, la valeur en cours et la valeur gagnée. */
export function summarize(rows: { status: string; estimatedValue: number | null }[], kinds: Map<string, "open" | "won" | "lost">) {
  const out = { opportunities: rows.length, openValue: 0, wonValue: 0 };
  for (const r of rows) {
    const kind = kinds.get(r.status) ?? "open";
    if (kind === "open") out.openValue += r.estimatedValue ?? 0;
    if (kind === "won") out.wonValue += r.estimatedValue ?? 0;
  }
  return out;
}

const taken = async (companyId: string, name: string, exceptId?: string) =>
  (await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.companyId, companyId))).some((a) => a.id !== exceptId && a.name.trim().toLowerCase() === name.trim().toLowerCase());

/** Comptes (entreprises clientes) et leurs opportunités. Tout membre voit les comptes ; il ne voit que les opportunités qu'il peut lire. */
export async function accountRoutes(app: FastifyInstance) {
  app.get("/accounts", { preHandler: requireMember }, async (req) => {
    const { subject } = req.member!;
    const list = await db.select().from(accounts).where(eq(accounts.companyId, subject.companyId)).orderBy(asc(accounts.name));
    if (list.length === 0) return [];
    const scope = can(subject, "lead:read") ? scopeCondition(leads, subject, "lead:read") : null;
    const rows = scope
      ? await db.select({ accountId: leads.accountId, status: leads.status, estimatedValue: leads.estimatedValue }).from(leads).where(and(scope, alive, inArray(leads.accountId, list.map((a) => a.id))))
      : [];
    const kinds = new Map((await listStages(subject.companyId)).map((s) => [s.key, s.kind]));
    return list.map((a) => ({ ...a, ...summarize(rows.filter((r) => r.accountId === a.id), kinds) }));
  });

  // Détail : le compte et ses opportunités lisibles.
  app.get<{ Params: { id: string } }>("/accounts/:id", { preHandler: requireMember }, async (req, reply) => {
    const { subject } = req.member!;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [account] = await db.select().from(accounts).where(and(eq(accounts.id, req.params.id), eq(accounts.companyId, subject.companyId)));
    if (!account) return reply.code(404).send({ error: "not_found" });
    const scope = can(subject, "lead:read") ? scopeCondition(leads, subject, "lead:read") : null;
    const rows = scope
      ? await db.select({ id: leads.id, name: leads.name, status: leads.status, estimatedValue: leads.estimatedValue, city: leads.city, service: leads.service, createdAt: leads.createdAt }).from(leads).where(and(scope, alive, eq(leads.accountId, account.id))).orderBy(asc(leads.createdAt))
      : [];
    const kinds = new Map((await listStages(subject.companyId)).map((s) => [s.key, s.kind]));
    return { ...account, ...summarize(rows, kinds), leads: rows };
  });

  app.post("/accounts", { preHandler: requirePermission("account:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId } = req.member!.subject;
    if (await taken(companyId, body.data.name)) return reply.code(409).send({ error: "account_exists" });
    const [created] = await db.insert(accounts).values({ ...body.data, companyId }).returning();
    req.auditLabel = created.name;
    return reply.code(201).send(created);
  });

  // Fait d'un lead le premier de ses opportunités : un compte est créé avec son nom, son secteur et son site, et le lead y est rattaché.
  app.post<{ Params: { id: string } }>("/leads/:id/account", { preHandler: requirePermission("account:create") }, async (req, reply) => {
    const { subject } = req.member!;
    const lead = await findReadableLead(subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", leadAttrs(lead))) return reply.code(403).send({ error: "forbidden" });
    if (lead.accountId) return reply.code(409).send({ error: "lead_has_account" });
    if (await taken(subject.companyId, lead.name)) return reply.code(409).send({ error: "account_exists" });
    const created = await db.transaction(async (tx) => {
      const [a] = await tx.insert(accounts).values({ companyId: subject.companyId, name: lead.name, sector: lead.sector, website: lead.website }).returning();
      await tx.update(leads).set({ accountId: a.id, updatedAt: new Date() }).where(eq(leads.id, lead.id));
      return a;
    });
    req.auditLabel = created.name;
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/accounts/:id", { preHandler: requirePermission("account:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId } = req.member!.subject;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    if (body.data.name && (await taken(companyId, body.data.name, req.params.id))) return reply.code(409).send({ error: "account_exists" });
    const [updated] = await db.update(accounts).set(body.data).where(and(eq(accounts.id, req.params.id), eq(accounts.companyId, companyId))).returning();
    if (!updated) return reply.code(404).send({ error: "not_found" });
    req.auditLabel = updated.name;
    return updated;
  });

  // Supprimer un compte détache ses opportunités (elles restent des leads) ; rien d'autre n'est perdu.
  app.delete<{ Params: { id: string } }>("/accounts/:id", { preHandler: requirePermission("account:delete") }, async (req, reply) => {
    const { companyId } = req.member!.subject;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [gone] = await db.delete(accounts).where(and(eq(accounts.id, req.params.id), eq(accounts.companyId, companyId))).returning();
    if (!gone) return reply.code(404).send({ error: "not_found" });
    req.auditLabel = gone.name;
    return reply.code(204).send();
  });
}

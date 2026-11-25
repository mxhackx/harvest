import type { FastifyInstance } from "fastify";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { kbArticles } from "../db/schema.js";
import { requireMember, requirePermission } from "../plugins/auth.js";

const uuid = z.string().uuid();
const tags = z.array(z.string().trim().min(1).max(30)).max(10).transform((t) => [...new Set(t.map((x) => x.toLowerCase()))]);
const body = z.object({ title: z.string().trim().min(1).max(150), body: z.string().trim().min(1).max(20_000), tags: tags.default([]) });
const patchBody = body.partial();
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Base de connaissances : les réponses fréquentes de l'équipe. Tout membre lit et cherche ; les gérer est un droit (kb:*). */
export async function kbRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>("/kb", { preHandler: requireMember }, async (req) => {
    const { companyId } = req.member!.subject;
    const q = (req.query.q ?? "").trim().slice(0, 100);
    const term = q ? `%${likeEscape(q)}%` : null;
    return db
      .select({ id: kbArticles.id, title: kbArticles.title, tags: kbArticles.tags, updatedAt: kbArticles.updatedAt, excerpt: sql<string>`left(${kbArticles.body}, 200)` })
      .from(kbArticles)
      .where(and(eq(kbArticles.companyId, companyId), term ? or(ilike(kbArticles.title, term), ilike(kbArticles.body, term), sql`${kbArticles.tags}::text ilike ${term}`) : undefined))
      .orderBy(asc(kbArticles.title))
      .limit(200);
  });

  app.get<{ Params: { id: string } }>("/kb/:id", { preHandler: requireMember }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [a] = await db.select().from(kbArticles).where(and(eq(kbArticles.id, req.params.id), eq(kbArticles.companyId, req.member!.subject.companyId)));
    return a ?? reply.code(404).send({ error: "not_found" });
  });

  app.post("/kb", { preHandler: requirePermission("kb:create") }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    const { companyId, userId } = req.member!.subject;
    const [created] = await db.insert(kbArticles).values({ ...parsed.data, companyId, createdBy: userId }).returning();
    req.auditLabel = created.title;
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/kb/:id", { preHandler: requirePermission("kb:update") }, async (req, reply) => {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) return reply.code(400).send({ error: "invalid_body", issues: parsed.success ? [] : parsed.error.issues });
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [u] = await db.update(kbArticles).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(kbArticles.id, req.params.id), eq(kbArticles.companyId, req.member!.subject.companyId))).returning();
    if (!u) return reply.code(404).send({ error: "not_found" });
    req.auditLabel = u.title;
    return u;
  });

  app.delete<{ Params: { id: string } }>("/kb/:id", { preHandler: requirePermission("kb:delete") }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [gone] = await db.delete(kbArticles).where(and(eq(kbArticles.id, req.params.id), eq(kbArticles.companyId, req.member!.subject.companyId))).returning();
    if (!gone) return reply.code(404).send({ error: "not_found" });
    req.auditLabel = gone.title;
    return reply.code(204).send();
  });
}

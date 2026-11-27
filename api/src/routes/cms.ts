import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { MAX_SITE_BYTES, siteData } from "../cms/site-schema.js";
import { db } from "../db/index.js";
import { cmsAccounts, cmsSites } from "../db/schema.js";
import { requireUser } from "../plugins/auth.js";

const uuid = z.string().uuid();
export const MAX_SITES = 20;
const saveBody = z.object({ data: siteData, version: z.number().int().min(1) });
const createBody = z.object({ data: siteData });

/** Le CMS est un produit à part : il faut avoir ouvert son « espace Sites ». Aucune entreprise CRM n'est demandée. */
async function requireCms(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  const [account] = await db.select().from(cmsAccounts).where(eq(cmsAccounts.userId, req.user!.id));
  if (!account) return reply.code(403).send({ error: "cms_not_activated" });
}

const pub = (s: typeof cmsSites.$inferSelect) => ({ id: s.id, version: s.version, updatedAt: s.updatedAt, data: s.data });
const mine = (userId: string, id: string) => and(eq(cmsSites.id, id), eq(cmsSites.ownerId, userId));
const tooBig = (data: unknown) => JSON.stringify(data).length > MAX_SITE_BYTES;
const write = { bodyLimit: MAX_SITE_BYTES + 200_000, config: { rateLimit: { max: process.env.NODE_ENV === "test" ? 10_000 : 120, timeWindow: "1 minute" } } };

/** Comptes et sites du CMS. Chaque site appartient à une personne : personne d'autre ne le voit. */
export async function cmsRoutes(app: FastifyInstance) {
  app.get("/cms/account", { preHandler: requireUser }, async (req) => {
    const [account] = await db.select().from(cmsAccounts).where(eq(cmsAccounts.userId, req.user!.id));
    return { activated: !!account };
  });

  // « Continuer avec Hivation » : ouvre l'espace Sites du compte connecté.
  app.post("/cms/account", { preHandler: requireUser }, async (req, reply) => {
    await db.insert(cmsAccounts).values({ userId: req.user!.id }).onConflictDoNothing();
    return reply.code(201).send({ activated: true });
  });

  app.get("/cms/sites", { preHandler: requireCms }, async (req) =>
    (await db.select().from(cmsSites).where(eq(cmsSites.ownerId, req.user!.id)).orderBy(desc(cmsSites.updatedAt))).map(pub),
  );

  app.post("/cms/sites", { ...write, preHandler: requireCms }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success || tooBig(body.data.data)) return reply.code(400).send({ error: body.success ? "site_too_big" : "invalid_body" });
    const owner = req.user!.id;
    if ((await db.select({ id: cmsSites.id }).from(cmsSites).where(eq(cmsSites.ownerId, owner))).length >= MAX_SITES) return reply.code(409).send({ error: "too_many_sites" });
    const [created] = await db.insert(cmsSites).values({ ownerId: owner, data: body.data.data }).returning();
    return reply.code(201).send(pub(created));
  });

  // `version` : celle que l'on a modifiée. Si le site a changé ailleurs entre-temps, rien n'est écrasé.
  app.put<{ Params: { id: string } }>("/cms/sites/:id", { ...write, preHandler: requireCms }, async (req, reply) => {
    const body = saveBody.safeParse(req.body);
    if (!body.success || tooBig(body.data.data)) return reply.code(400).send({ error: body.success ? "site_too_big" : "invalid_body" });
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const where = mine(req.user!.id, req.params.id);
    const [updated] = await db
      .update(cmsSites)
      .set({ data: body.data.data, version: body.data.version + 1, updatedAt: new Date() })
      .where(and(where, eq(cmsSites.version, body.data.version)))
      .returning();
    if (updated) return pub(updated);
    const [exists] = await db.select({ id: cmsSites.id }).from(cmsSites).where(where);
    return reply.code(exists ? 409 : 404).send({ error: exists ? "site_conflict" : "not_found" });
  });

  app.delete<{ Params: { id: string } }>("/cms/sites/:id", { preHandler: requireCms }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [gone] = await db.delete(cmsSites).where(mine(req.user!.id, req.params.id)).returning({ id: cmsSites.id });
    return gone ? reply.code(204).send() : reply.code(404).send({ error: "not_found" });
  });
}

import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { webhooks } from "../db/schema.js";
import { requirePermission } from "../plugins/auth.js";
import { EVENTS, checkUrl, newSecret, post } from "../webhooks/deliver.js";

const uuid = z.string().uuid();
const createBody = z.object({
  url: z.string().trim().url().max(500),
  events: z.array(z.enum(EVENTS.filter((e) => e !== "ping") as [string, ...string[]])).min(1),
});
const MAX_PER_COMPANY = 10;
const pub = (h: typeof webhooks.$inferSelect) => ({ id: h.id, url: h.url, events: h.events, active: h.active, failures: h.failures, lastStatus: h.lastStatus, lastAt: h.lastAt, createdAt: h.createdAt });

/** Webhooks sortants : réservés au CEO. Le secret de signature n'est renvoyé qu'à la création. */
export async function webhookRoutes(app: FastifyInstance) {
  app.get("/webhooks", { preHandler: requirePermission("webhook:read") }, async (req) =>
    (await db.select().from(webhooks).where(eq(webhooks.companyId, req.member!.subject.companyId)).orderBy(asc(webhooks.createdAt))).map(pub),
  );

  app.post("/webhooks", { preHandler: requirePermission("webhook:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId } = req.member!.subject;
    const problem = await checkUrl(body.data.url);
    if (problem) return reply.code(400).send({ error: "invalid_body", issues: [{ message: problem, path: ["url"] }] });
    const count = (await db.select({ id: webhooks.id }).from(webhooks).where(eq(webhooks.companyId, companyId))).length;
    if (count >= MAX_PER_COMPANY) return reply.code(409).send({ error: "too_many_webhooks" });
    const secret = newSecret();
    const [created] = await db.insert(webhooks).values({ companyId, url: body.data.url, events: [...new Set(body.data.events)], secret }).returning();
    req.auditLabel = new URL(created.url).host;
    return reply.code(201).send({ ...pub(created), secret });
  });

  // Envoie un événement « ping » pour vérifier que l'adresse répond et que la signature est bien lue.
  app.post<{ Params: { id: string } }>("/webhooks/:id/test", { preHandler: requirePermission("webhook:create") }, async (req, reply) => {
    const { companyId } = req.member!.subject;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [h] = await db.select().from(webhooks).where(and(eq(webhooks.id, req.params.id), eq(webhooks.companyId, companyId)));
    if (!h) return reply.code(404).send({ error: "not_found" });
    return { status: await post(h.url, h.secret, "ping", { message: "Test Hivation" }) };
  });

  app.delete<{ Params: { id: string } }>("/webhooks/:id", { preHandler: requirePermission("webhook:delete") }, async (req, reply) => {
    const { companyId } = req.member!.subject;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [h] = await db.select().from(webhooks).where(and(eq(webhooks.id, req.params.id), eq(webhooks.companyId, companyId)));
    if (!h) return reply.code(404).send({ error: "not_found" });
    await db.delete(webhooks).where(eq(webhooks.id, h.id));
    req.auditLabel = new URL(h.url).host;
    return reply.code(204).send();
  });
}

import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { isUniqueViolation } from "../db/errors.js";
import { messageTemplates } from "../db/schema.js";
import { requireMember, requirePermission } from "../plugins/auth.js";

const uuid = z.string().uuid();
const fields = z.object({
  name: z.string().trim().min(1).max(80),
  channel: z.enum(["whatsapp", "email"]),
  body: z.string().trim().min(1).max(2000),
});
const patchBody = fields.partial();
const MAX_TEMPLATES = 100;


/** Modèles de messages : lisibles par tout membre, gérés par ceux qui ont `template:*`. */
export async function templateRoutes(app: FastifyInstance) {
  app.get("/templates", { preHandler: requireMember }, async (req) =>
    db.select().from(messageTemplates).where(eq(messageTemplates.companyId, req.member!.subject.companyId)).orderBy(asc(messageTemplates.name)),
  );

  app.post("/templates", { preHandler: requirePermission("template:create") }, async (req, reply) => {
    const body = fields.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const existing = await db.select({ id: messageTemplates.id }).from(messageTemplates).where(eq(messageTemplates.companyId, subject.companyId));
    if (existing.length >= MAX_TEMPLATES) return reply.code(409).send({ error: "too_many_templates" });
    try {
      const [created] = await db.insert(messageTemplates).values({ ...body.data, companyId: subject.companyId, createdBy: subject.userId }).returning();
      return reply.code(201).send(created);
    } catch (e) {
      if (isUniqueViolation(e)) return reply.code(409).send({ error: "template_exists" });
      throw e;
    }
  });

  app.patch<{ Params: { id: string } }>("/templates/:id", { preHandler: requirePermission("template:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ error: "invalid_body", issues: body.success ? [] : body.error.issues });
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    try {
      const [updated] = await db
        .update(messageTemplates)
        .set({ ...body.data, updatedAt: new Date() })
        .where(and(eq(messageTemplates.id, req.params.id), eq(messageTemplates.companyId, req.member!.subject.companyId)))
        .returning();
      return updated ?? reply.code(404).send({ error: "not_found" });
    } catch (e) {
      if (isUniqueViolation(e)) return reply.code(409).send({ error: "template_exists" });
      throw e;
    }
  });

  app.delete<{ Params: { id: string } }>("/templates/:id", { preHandler: requirePermission("template:delete") }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const gone = await db
      .delete(messageTemplates)
      .where(and(eq(messageTemplates.id, req.params.id), eq(messageTemplates.companyId, req.member!.subject.companyId)))
      .returning({ id: messageTemplates.id });
    return gone.length ? reply.code(204).send() : reply.code(404).send({ error: "not_found" });
  });
}

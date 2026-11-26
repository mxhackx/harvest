import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { workflows } from "../db/schema.js";
import { requirePermission } from "../plugins/auth.js";
import { emptyGraph, graphSchema } from "../workflows/graph.js";

const uuid = z.string().uuid();
const MAX = 50;
const name = z.string().trim().min(1).max(80);
const createBody = z.object({ name, graph: graphSchema.optional() });
const patchBody = z.object({ name: name.optional(), graph: graphSchema.optional() });

/** Workflows : les définitions dessinées dans l'éditeur. Leur exécution (moteur d'agents) n'est pas encore construite. */
export async function workflowRoutes(app: FastifyInstance) {
  const own = (companyId: string, id: string) => and(eq(workflows.id, id), eq(workflows.companyId, companyId));

  app.get("/workflows", { preHandler: requirePermission("workflow:read") }, async (req) =>
    db
      .select({ id: workflows.id, name: workflows.name, updatedAt: workflows.updatedAt })
      .from(workflows)
      .where(eq(workflows.companyId, req.member!.subject.companyId))
      .orderBy(asc(workflows.createdAt)),
  );

  app.get<{ Params: { id: string } }>("/workflows/:id", { preHandler: requirePermission("workflow:read") }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [w] = await db.select().from(workflows).where(own(req.member!.subject.companyId, req.params.id));
    return w ?? reply.code(404).send({ error: "not_found" });
  });

  app.post("/workflows", { preHandler: requirePermission("workflow:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId, userId } = req.member!.subject;
    if ((await db.select({ id: workflows.id }).from(workflows).where(eq(workflows.companyId, companyId))).length >= MAX) return reply.code(409).send({ error: "too_many_workflows" });
    const [created] = await db.insert(workflows).values({ companyId, createdBy: userId, name: body.data.name, graph: body.data.graph ?? emptyGraph() }).returning();
    req.auditLabel = created.name;
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/workflows/:id", { preHandler: requirePermission("workflow:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ error: "invalid_body", issues: body.success ? [] : body.error.issues });
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [updated] = await db.update(workflows).set({ ...body.data, updatedAt: new Date() }).where(own(req.member!.subject.companyId, req.params.id)).returning();
    if (!updated) return reply.code(404).send({ error: "not_found" });
    req.auditLabel = updated.name;
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/workflows/:id", { preHandler: requirePermission("workflow:delete") }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [gone] = await db.delete(workflows).where(own(req.member!.subject.companyId, req.params.id)).returning();
    if (!gone) return reply.code(404).send({ error: "not_found" });
    req.auditLabel = gone.name;
    return reply.code(204).send();
  });
}

import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { automationRuns, automations, memberships } from "../db/schema.js";
import { assignParams, emailParams, taskParams } from "../automations/run.js";
import { requirePermission } from "../plugins/auth.js";

const uuid = z.string().uuid();
const MAX = 20;
const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("assign"), name: z.string().trim().min(1).max(80), params: assignParams }),
  z.object({ kind: z.literal("task"), name: z.string().trim().min(1).max(80), params: taskParams }),
  z.object({ kind: z.literal("email"), name: z.string().trim().min(1).max(80), params: emailParams }),
]);
const patchBody = z.object({ name: z.string().trim().min(1).max(80).optional(), active: z.boolean().optional() });

/** Automatisations : répartir les nouveaux leads, relancer par une tâche ou un e-mail. Gérées par ceux qui ont le droit « automation ». */
export async function automationRoutes(app: FastifyInstance) {
  app.get("/automations", { preHandler: requirePermission("automation:read") }, async (req) => {
    const rows = await db.select().from(automations).where(eq(automations.companyId, req.member!.subject.companyId)).orderBy(asc(automations.createdAt));
    const runs = await db.select({ id: automationRuns.automationId, outcome: automationRuns.outcome }).from(automationRuns);
    const mine = new Set(rows.map((r) => r.id));
    return rows.map((r) => ({ ...r, done: runs.filter((x) => mine.has(x.id) && x.id === r.id && x.outcome === "done").length }));
  });

  app.post("/automations", { preHandler: requirePermission("automation:create") }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    const { companyId } = req.member!.subject;
    if ((await db.select({ id: automations.id }).from(automations).where(eq(automations.companyId, companyId))).length >= MAX) return reply.code(409).send({ error: "too_many_automations" });
    if (parsed.data.kind === "assign") {
      const members = await db.select({ userId: memberships.userId }).from(memberships).where(eq(memberships.companyId, companyId));
      if (!parsed.data.params.userIds.every((u) => members.some((m) => m.userId === u))) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "personne introuvable dans l'entreprise", path: ["params", "userIds"] }] });
    }
    const [created] = await db.insert(automations).values({ companyId, name: parsed.data.name, kind: parsed.data.kind, params: parsed.data.params }).returning();
    req.auditLabel = created.name;
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/automations/:id", { preHandler: requirePermission("automation:update") }, async (req, reply) => {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) return reply.code(400).send({ error: "invalid_body", issues: parsed.success ? [] : parsed.error.issues });
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [u] = await db.update(automations).set(parsed.data).where(and(eq(automations.id, req.params.id), eq(automations.companyId, req.member!.subject.companyId))).returning();
    if (!u) return reply.code(404).send({ error: "not_found" });
    req.auditLabel = `${u.name}${parsed.data.active === undefined ? "" : parsed.data.active ? " (activée)" : " (désactivée)"}`;
    return u;
  });

  app.delete<{ Params: { id: string } }>("/automations/:id", { preHandler: requirePermission("automation:delete") }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [gone] = await db.delete(automations).where(and(eq(automations.id, req.params.id), eq(automations.companyId, req.member!.subject.companyId))).returning();
    if (!gone) return reply.code(404).send({ error: "not_found" });
    req.auditLabel = gone.name;
    return reply.code(204).send();
  });
}

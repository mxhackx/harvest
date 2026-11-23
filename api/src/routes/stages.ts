import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { leads, pipelineStages } from "../db/schema.js";
import { COLOR_RE } from "../stages/defaults.js";
import { countLeadsIn, listStages, normalizePositions, uniqueKey, type Stage } from "../stages/store.js";
import { requireMember, requirePermission } from "../plugins/auth.js";

const uuid = z.string().uuid();
const fields = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(COLOR_RE, "couleur invalide (#rrggbb ou rgba(…))"),
  probability: z.number().int().min(0).max(100),
  kind: z.enum(["open", "won", "lost"]),
});
const createBody = fields.partial({ probability: true, kind: true }).transform((v) => ({ ...v, probability: v.probability ?? 0, kind: v.kind ?? ("open" as const) }));
const patchBody = fields.partial();
const reorderBody = z.object({ ids: z.array(uuid).min(1).max(50) });

const sameName = (stages: Stage[], name: string, exceptId?: string) =>
  stages.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === name.trim().toLowerCase());

/** Met les leads d'une étape en accord avec un nouveau type d'étape (date de clôture, motif de perte). */
async function realignLeads(companyId: string, key: string, kind: Stage["kind"]) {
  await db
    .update(leads)
    .set({
      closedAt: kind === "open" ? null : sql`coalesce(${leads.closedAt}, now())`,
      lostReason: kind === "lost" ? sql`${leads.lostReason}` : "",
    })
    .where(and(eq(leads.companyId, companyId), eq(leads.status, key)));
}

export async function stageRoutes(app: FastifyInstance) {
  // Tout membre lit les étapes : il en a besoin pour afficher ses leads.
  app.get("/stages", { preHandler: requireMember }, async (req) => listStages(req.member!.subject.companyId));

  app.post("/stages", { preHandler: requirePermission("stage:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId } = req.member!.subject;
    const stages = await listStages(companyId);
    if (sameName(stages, body.data.name)) return reply.code(409).send({ error: "stage_exists" });
    if (stages.length >= 20) return reply.code(409).send({ error: "too_many_stages" });
    const [created] = await db
      .insert(pipelineStages)
      .values({ ...body.data, companyId, key: uniqueKey(body.data.name, stages.map((s) => s.key)), position: stages.length })
      .returning();
    await normalizePositions(companyId);
    return reply.code(201).send((await listStages(companyId)).find((s) => s.id === created.id));
  });

  app.patch<{ Params: { id: string } }>("/stages/:id", { preHandler: requirePermission("stage:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId } = req.member!.subject;
    const stages = await listStages(companyId);
    const stage = uuid.safeParse(req.params.id).success ? stages.find((s) => s.id === req.params.id) : undefined;
    if (!stage) return reply.code(404).send({ error: "not_found" });
    if (body.data.name && sameName(stages, body.data.name, stage.id)) return reply.code(409).send({ error: "stage_exists" });
    // il faut toujours une étape ouverte : c'est là qu'arrivent les nouveaux leads
    if (body.data.kind && body.data.kind !== "open" && stage.kind === "open" && stages.filter((s) => s.kind === "open").length === 1) {
      return reply.code(409).send({ error: "last_open_stage" });
    }
    const [updated] = await db.update(pipelineStages).set(body.data).where(eq(pipelineStages.id, stage.id)).returning();
    if (body.data.kind && body.data.kind !== stage.kind) {
      await realignLeads(companyId, stage.key, body.data.kind);
      await normalizePositions(companyId);
    }
    return (await listStages(companyId)).find((s) => s.id === updated.id);
  });

  app.post("/stages/reorder", { preHandler: requirePermission("stage:update") }, async (req, reply) => {
    const body = reorderBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId } = req.member!.subject;
    const stages = await listStages(companyId);
    const ids = body.data.ids;
    // la liste doit contenir exactement les étapes de l'entreprise, ni plus ni moins
    if (ids.length !== stages.length || new Set(ids).size !== ids.length || !ids.every((id) => stages.some((s) => s.id === id))) {
      return reply.code(400).send({ error: "invalid_body", issues: [{ message: "la liste doit contenir toutes les étapes, une seule fois", path: ["ids"] }] });
    }
    await Promise.all(ids.map((id, i) => db.update(pipelineStages).set({ position: i }).where(eq(pipelineStages.id, id))));
    await normalizePositions(companyId); // les étapes ouvertes restent avant « gagné » et « perdu »
    return listStages(companyId);
  });

  app.delete<{ Params: { id: string }; Querystring: { moveTo?: string } }>("/stages/:id", { preHandler: requirePermission("stage:delete") }, async (req, reply) => {
    const { companyId } = req.member!.subject;
    const stages = await listStages(companyId);
    const stage = uuid.safeParse(req.params.id).success ? stages.find((s) => s.id === req.params.id) : undefined;
    if (!stage) return reply.code(404).send({ error: "not_found" });
    if (stage.kind === "open" && stages.filter((s) => s.kind === "open").length === 1) return reply.code(409).send({ error: "last_open_stage" });

    const inUse = await countLeadsIn(companyId, stage.key);
    if (inUse > 0) {
      // supprimer une étape ne supprime jamais de leads : il faut dire où ils vont
      const target = req.query.moveTo ? stages.find((s) => s.key === req.query.moveTo && s.id !== stage.id) : undefined;
      if (!req.query.moveTo) return reply.code(409).send({ error: "stage_in_use", leads: inUse });
      if (!target) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "étape de destination inconnue", path: ["moveTo"] }] });
      await db
        .update(leads)
        .set({
          status: target.key,
          closedAt: target.kind === "open" ? null : sql`coalesce(${leads.closedAt}, now())`,
          lostReason: target.kind === "lost" ? sql`${leads.lostReason}` : "",
        })
        .where(and(eq(leads.companyId, companyId), eq(leads.status, stage.key)));
    }
    await db.delete(pipelineStages).where(eq(pipelineStages.id, stage.id));
    await normalizePositions(companyId);
    return reply.code(204).send();
  });
}

import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { regions, waves } from "../db/schema.js";
import { requireMember, requirePermission } from "../plugins/auth.js";
import { emitWebhook } from "../webhooks/deliver.js";
import { computeBilan, todayString, wavePhase, type Wave } from "../waves/stats.js";

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date AAAA-MM-JJ");
const fields = z.object({
  regionId: uuid,
  name: z.string().trim().min(1).max(80),
  startsOn: day,
  endsOn: day,
  targetVisits: z.number().int().min(0).max(100_000).default(0),
});
const createBody = fields.refine((v) => v.endsOn >= v.startsOn, { message: "la fin précède le début", path: ["endsOn"] });
const patchBody = fields.omit({ regionId: true }).partial();

async function findWave(companyId: string, id: string): Promise<Wave | null> {
  if (!uuid.safeParse(id).success) return null;
  const [w] = await db.select().from(waves).where(and(eq(waves.id, id), eq(waves.companyId, companyId)));
  return w ?? null;
}

/** Vague avec sa région, sa phase et ses chiffres : le bilan figé si elle est clôturée, sinon l'état actuel. */
async function present(w: Wave) {
  const [region] = await db.select().from(regions).where(eq(regions.id, w.regionId));
  const stats = w.closedAt && w.bilan ? w.bilan : (await computeBilan(w)).bilan;
  return { ...w, phase: wavePhase(w, todayString()), region: region ? { id: region.id, name: region.name, lat: region.lat, lng: region.lng, radiusKm: region.radiusKm } : null, stats };
}

/** Vagues de prospection. Tout membre les lit ; les gérer est un droit (`wave:*`). */
export async function waveRoutes(app: FastifyInstance) {
  app.get("/waves", { preHandler: requireMember }, async (req) => {
    const rows = await db.select().from(waves).where(eq(waves.companyId, req.member!.subject.companyId)).orderBy(desc(waves.startsOn), asc(waves.name));
    return Promise.all(rows.map(present));
  });

  app.post("/waves", { preHandler: requirePermission("wave:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId, userId } = req.member!.subject;
    const [region] = await db.select({ id: regions.id }).from(regions).where(and(eq(regions.id, body.data.regionId), eq(regions.companyId, companyId)));
    if (!region) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "région introuvable", path: ["regionId"] }] });
    const [created] = await db.insert(waves).values({ ...body.data, companyId, createdBy: userId }).returning();
    req.auditLabel = created.name;
    return reply.code(201).send(await present(created));
  });

  app.patch<{ Params: { id: string } }>("/waves/:id", { preHandler: requirePermission("wave:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const wave = await findWave(req.member!.subject.companyId, req.params.id);
    if (!wave) return reply.code(404).send({ error: "not_found" });
    if (wave.closedAt) return reply.code(409).send({ error: "wave_closed" });
    const startsOn = body.data.startsOn ?? wave.startsOn;
    const endsOn = body.data.endsOn ?? wave.endsOn;
    if (endsOn < startsOn) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "la fin précède le début", path: ["endsOn"] }] });
    const [updated] = await db.update(waves).set(body.data).where(eq(waves.id, wave.id)).returning();
    req.auditLabel = updated.name;
    return present(updated);
  });

  app.delete<{ Params: { id: string } }>("/waves/:id", { preHandler: requirePermission("wave:delete") }, async (req, reply) => {
    const wave = await findWave(req.member!.subject.companyId, req.params.id);
    if (!wave) return reply.code(404).send({ error: "not_found" });
    await db.delete(waves).where(eq(waves.id, wave.id));
    req.auditLabel = wave.name;
    return reply.code(204).send();
  });

  // Les leads à repasser : encore ouverts et non visités pendant la période (état actuel, même pour une vague clôturée).
  app.get<{ Params: { id: string } }>("/waves/:id/revisit", { preHandler: requireMember }, async (req, reply) => {
    const wave = await findWave(req.member!.subject.companyId, req.params.id);
    if (!wave) return reply.code(404).send({ error: "not_found" });
    return (await computeBilan(wave)).toRevisit;
  });

  // Clôture : le bilan est figé (visités, convertis, à repasser tels qu'ils sont ce jour-là).
  app.post<{ Params: { id: string } }>("/waves/:id/close", { preHandler: requirePermission("wave:update") }, async (req, reply) => {
    const wave = await findWave(req.member!.subject.companyId, req.params.id);
    if (!wave) return reply.code(404).send({ error: "not_found" });
    if (wave.closedAt) return reply.code(409).send({ error: "wave_closed" });
    const { bilan } = await computeBilan(wave);
    const [closed] = await db.update(waves).set({ closedAt: new Date(), bilan }).where(eq(waves.id, wave.id)).returning();
    req.auditLabel = closed.name;
    const result = await present(closed);
    void emitWebhook(closed.companyId, "wave.closed", { id: closed.id, name: closed.name, stats: result.stats });
    return result;
  });
}

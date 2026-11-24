import type { FastifyInstance } from "fastify";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { regions, waves } from "../db/schema.js";
import { requireMember, requirePermission } from "../plugins/auth.js";
import { assignRegions } from "../waves/geo.js";

const uuid = z.string().uuid();
const fields = z.object({
  name: z.string().trim().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.1).max(500),
});
const patchBody = fields.partial();

const taken = async (companyId: string, name: string, exceptId?: string) =>
  (await db.select({ id: regions.id, name: regions.name }).from(regions).where(eq(regions.companyId, companyId))).some(
    (r) => r.id !== exceptId && r.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

/** Régions de prospection : un centre et un rayon. Tout membre les lit ; les gérer est un droit (`wave:*`). */
export async function regionRoutes(app: FastifyInstance) {
  app.get("/regions", { preHandler: requireMember }, async (req) => {
    const { companyId } = req.member!.subject;
    const count = sql<number>`(select count(*)::int from leads l where l.region_id = "regions"."id" and l.deleted_at is null)`.as("lead_count");
    return db.select({ ...regionColumns, leadCount: count }).from(regions).where(eq(regions.companyId, companyId)).orderBy(asc(regions.name));
  });

  app.post("/regions", { preHandler: requirePermission("wave:create") }, async (req, reply) => {
    const body = fields.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId } = req.member!.subject;
    if (await taken(companyId, body.data.name)) return reply.code(409).send({ error: "region_exists" });
    const [created] = await db.insert(regions).values({ ...body.data, companyId }).returning();
    await assignRegions(companyId); // les leads déjà présents dans la zone y entrent
    req.auditLabel = created.name;
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/regions/:id", { preHandler: requirePermission("wave:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { companyId } = req.member!.subject;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    if (body.data.name && (await taken(companyId, body.data.name, req.params.id))) return reply.code(409).send({ error: "region_exists" });
    const [updated] = await db
      .update(regions)
      .set(body.data)
      .where(and(eq(regions.id, req.params.id), eq(regions.companyId, companyId)))
      .returning();
    if (!updated) return reply.code(404).send({ error: "not_found" });
    if (body.data.lat !== undefined || body.data.lng !== undefined || body.data.radiusKm !== undefined) await assignRegions(companyId);
    req.auditLabel = updated.name;
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/regions/:id", { preHandler: requirePermission("wave:delete") }, async (req, reply) => {
    const { companyId } = req.member!.subject;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [region] = await db.select().from(regions).where(and(eq(regions.id, req.params.id), eq(regions.companyId, companyId)));
    if (!region) return reply.code(404).send({ error: "not_found" });
    // une région qui a eu des vagues garde son historique : on ne la supprime pas
    const [used] = await db.select({ id: waves.id }).from(waves).where(eq(waves.regionId, region.id)).limit(1);
    if (used) return reply.code(409).send({ error: "region_in_use" });
    await db.delete(regions).where(eq(regions.id, region.id)); // region_id des leads passe à null
    await assignRegions(companyId); // un autre cercle peut les reprendre
    req.auditLabel = region.name;
    return reply.code(204).send();
  });
}

const regionColumns = {
  id: regions.id,
  name: regions.name,
  lat: regions.lat,
  lng: regions.lng,
  radiusKm: regions.radiusKm,
  createdAt: regions.createdAt,
};

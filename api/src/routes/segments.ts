import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { isUniqueViolation } from "../db/errors.js";
import { segments } from "../db/schema.js";
import { requirePermission } from "../plugins/auth.js";

const uuid = z.string().uuid();
const MAX_SEGMENTS = 30;

/** Ce que la page Leads sait enregistrer : recherche, onglet, tri et filtres. Rien d'autre n'est accepté ni stocké. */
const config = z.object({
  tab: z.string().max(40),
  query: z.string().max(100),
  sort: z.string().max(40),
  filters: z.object({
    visit: z.enum(["all", "to_visit", "visited"]),
    position: z.enum(["all", "with", "without"]),
    sector: z.string().max(100),
  }),
});
const body = z.object({ name: z.string().trim().min(1).max(60), config });


/** Segments : vues de leads personnelles. Chacun ne voit, ne crée et ne supprime que les siens. */
export async function segmentRoutes(app: FastifyInstance) {
  const mine = (req: { member: { subject: { companyId: string; userId: string } } | null }) =>
    and(eq(segments.companyId, req.member!.subject.companyId), eq(segments.userId, req.member!.subject.userId));

  app.get("/segments", { preHandler: requirePermission("lead:read") }, async (req) =>
    db.select({ id: segments.id, name: segments.name, config: segments.config }).from(segments).where(mine(req)).orderBy(asc(segments.name)),
  );

  app.post("/segments", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    const { subject } = req.member!;
    const count = await db.select({ id: segments.id }).from(segments).where(mine(req));
    if (count.length >= MAX_SEGMENTS) return reply.code(409).send({ error: "too_many_segments" });
    try {
      const [created] = await db
        .insert(segments)
        .values({ companyId: subject.companyId, userId: subject.userId, name: parsed.data.name, config: parsed.data.config })
        .returning({ id: segments.id, name: segments.name, config: segments.config });
      return reply.code(201).send(created);
    } catch (e) {
      if (isUniqueViolation(e)) return reply.code(409).send({ error: "segment_exists" });
      throw e;
    }
  });

  app.delete<{ Params: { id: string } }>("/segments/:id", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const gone = await db.delete(segments).where(and(mine(req), eq(segments.id, req.params.id))).returning({ id: segments.id });
    return gone.length ? reply.code(204).send() : reply.code(404).send({ error: "not_found" });
  });
}

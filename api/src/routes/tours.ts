import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { leads, tours } from "../db/schema.js";
import { alive } from "../leads/access.js";
import { planRoute, schedule, type Plan } from "../routing/plan.js";
import { requirePermission } from "../plugins/auth.js";
import { scopeCondition } from "../rbac/sql.js";

const uuid = z.string().uuid();
const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), label: z.string().trim().max(120).default("") });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "heure HH:MM");
export const MAX_STOPS = 30;

const planBody = z.object({
  start: point,
  /** arrivée fixée (ex. retour au départ) ; null ou absente = la tournée finit à la dernière étape */
  end: point.nullable().optional(),
  leadIds: z.array(uuid).min(1).max(MAX_STOPS),
  /** true = chercher le meilleur ordre ; false = garder l'ordre donné */
  optimize: z.boolean().default(false),
  startTime: time.default("08:00"),
  stopMinutes: z.number().int().min(0).max(240).default(20),
});
const saveBody = planBody.extend({ name: z.string().trim().min(1).max(100), plannedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const patchBody = z.object({ name: z.string().trim().min(1).max(100).optional(), plannedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), status: z.enum(["planned", "done"]).optional() });

type Stop = typeof tours.$inferInsert["stops"] extends infer S ? (S extends (infer E)[] ? E : never) : never;

/**
 * Étapes d'une tournée : des prospects à visiter en présentiel, avec une position, que la personne peut lire, dans l'ordre
 * demandé. Renvoie aussi les identifiants refusés (introuvables, à distance, sans position ou hors de sa portée).
 */
async function loadStops(subject: Parameters<typeof scopeCondition>[1], ids: string[]): Promise<{ stops: Stop[]; refused: string[] }> {
  const scope = scopeCondition(leads, subject, "lead:read");
  const rows = scope
    ? await db.select({ id: leads.id, name: leads.name, city: leads.city, phone: leads.phone, lat: leads.lat, lng: leads.lng, visitMode: leads.visitMode }).from(leads).where(and(scope, alive, inArray(leads.id, ids)))
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const stops: Stop[] = [];
  const refused: string[] = [];
  for (const id of [...new Set(ids)]) {
    const r = byId.get(id);
    if (!r || r.visitMode !== "onsite" || r.lat === null || r.lng === null) refused.push(id);
    else stops.push({ leadId: r.id, name: r.name, city: r.city, phone: r.phone, lat: r.lat, lng: r.lng });
  }
  return { stops, refused };
}

type Body = z.infer<typeof planBody>;
/** Calcule l'itinéraire d'une tournée : départ, étapes (réordonnées si demandé), arrivée éventuelle, tronçons et horaires. */
async function compute(stops: Stop[], body: Body) {
  const points = [body.start, ...stops, ...(body.end ? [body.end] : [])];
  const plan: Plan = await planRoute(points, { optimize: body.optimize, fixedEnd: !!body.end });
  const inner = plan.order.filter((i) => i !== 0 && !(body.end && i === points.length - 1)); // indices des étapes, dans l'ordre
  const ordered = inner.map((i) => stops[i - 1]);
  return { ordered, plan, ...schedule(body.startTime, plan.legs, body.stopMinutes) };
}

/** Tournées (planificateur de visites) : calcul d'un itinéraire entre les prospects à visiter, et tournées enregistrées de chacun. */
export async function tourRoutes(app: FastifyInstance) {
  // Calcule sans enregistrer : ordre (optimisé ou non), tronçons, horaires, tracé.
  app.post("/tours/plan", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const body = planBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { stops, refused } = await loadStops(req.member!.subject, body.data.leadIds);
    if (refused.length) return reply.code(400).send({ error: "invalid_stops", refused });
    const { ordered, plan, arrivals, endsAt, totalMinutes } = await compute(stops, body.data);
    return { stops: ordered, legs: plan.legs, totalKm: plan.totalKm, drivingMin: plan.totalMin, totalMin: totalMinutes, arrivals, endsAt, geometry: plan.geometry, approximate: plan.approximate };
  });

  app.post("/tours", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const body = saveBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const { stops, refused } = await loadStops(subject, body.data.leadIds);
    if (refused.length) return reply.code(400).send({ error: "invalid_stops", refused });
    const { ordered, plan, totalMinutes } = await compute(stops, body.data);
    const [created] = await db
      .insert(tours)
      .values({
        companyId: subject.companyId,
        ownerId: subject.userId,
        name: body.data.name,
        plannedOn: body.data.plannedOn,
        startTime: body.data.startTime,
        stopMinutes: body.data.stopMinutes,
        start: body.data.start,
        end: body.data.end ?? null,
        stops: ordered,
        legs: plan.legs,
        geometry: plan.geometry,
        totalKm: plan.totalKm,
        totalMin: totalMinutes,
        approximate: plan.approximate,
      })
      .returning();
    req.auditLabel = created.name;
    return reply.code(201).send(present(created));
  });

  app.get("/tours", { preHandler: requirePermission("lead:read") }, async (req) => {
    const { subject } = req.member!;
    const rows = await db.select().from(tours).where(and(eq(tours.companyId, subject.companyId), eq(tours.ownerId, subject.userId))).orderBy(desc(tours.plannedOn), desc(tours.createdAt)).limit(200);
    return rows.map(present);
  });

  app.get<{ Params: { id: string } }>("/tours/:id", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const tour = await mine(req.member!.subject, req.params.id);
    return tour ? present(tour) : reply.code(404).send({ error: "not_found" });
  });

  app.patch<{ Params: { id: string } }>("/tours/:id", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ error: "invalid_body", issues: body.success ? [] : body.error.issues });
    const tour = await mine(req.member!.subject, req.params.id);
    if (!tour) return reply.code(404).send({ error: "not_found" });
    const [updated] = await db.update(tours).set(body.data).where(eq(tours.id, tour.id)).returning();
    return present(updated);
  });

  app.delete<{ Params: { id: string } }>("/tours/:id", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const tour = await mine(req.member!.subject, req.params.id);
    if (!tour) return reply.code(404).send({ error: "not_found" });
    await db.delete(tours).where(eq(tours.id, tour.id));
    return reply.code(204).send();
  });
}

async function mine(subject: { companyId: string; userId: string }, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [t] = await db.select().from(tours).where(and(eq(tours.id, id), eq(tours.companyId, subject.companyId), eq(tours.ownerId, subject.userId)));
  return t ?? null;
}

/** Une tournée enregistrée, avec les horaires d'arrivée recalculés à partir de ses tronçons. */
function present(t: typeof tours.$inferSelect) {
  const { arrivals, endsAt } = schedule(t.startTime, t.legs, t.stopMinutes);
  return { ...t, arrivals, endsAt };
}

import type { FastifyInstance } from "fastify";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { activities, leads, memberships, objectives, users } from "../db/schema.js";
import { alive } from "../leads/access.js";
import { monthBounds, monthStart, percent } from "../objectives/month.js";
import { can } from "../rbac/policy.js";
import { requireMember, requirePermission } from "../plugins/auth.js";
import { listStages } from "../stages/store.js";

const query = z.object({ month: z.string().optional() });
const putBody = z.object({
  userId: z.string().uuid(),
  month: z.string(),
  targetVisits: z.number().int().min(0).max(100_000),
  targetWon: z.number().int().min(0).max(100_000),
  targetValue: z.number().int().min(0).max(2_000_000_000),
});

/** Objectifs mensuels par personne et avancement réel. Chacun voit les siens ; qui peut lire les membres voit toute l'équipe. */
export async function objectiveRoutes(app: FastifyInstance) {
  app.get("/objectives", { preHandler: requireMember }, async (req, reply) => {
    const q = query.safeParse(req.query);
    const month = q.success ? monthStart(q.data.month ?? new Date().toISOString().slice(0, 7)) : null;
    if (!month) return reply.code(400).send({ error: "invalid_query", issues: [{ message: "mois invalide (AAAA-MM)", path: ["month"] }] });
    const { subject } = req.member!;
    const everyone = can(subject, "member:read");
    const people = await db
      .select({ userId: users.id, name: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.companyId, subject.companyId), everyone ? undefined : eq(memberships.userId, subject.userId)));
    const ids = people.map((p) => p.userId);
    if (ids.length === 0) return { month, items: [] };
    const { from, to } = monthBounds(month);

    const targets = await db.select().from(objectives).where(and(eq(objectives.companyId, subject.companyId), eq(objectives.month, month), inArray(objectives.userId, ids)));
    // visites : notes « visite » et passages à « visité », par auteur
    const visitRows = await db
      .select({ authorId: activities.authorId, n: sql<number>`count(*)::int` })
      .from(activities)
      .innerJoin(leads, eq(leads.id, activities.leadId))
      .where(
        and(
          eq(leads.companyId, subject.companyId),
          alive,
          inArray(activities.authorId, ids),
          gte(activities.occurredAt, from),
          lt(activities.occurredAt, to),
          sql`(${activities.kind} = 'visit' or (${activities.kind} = 'visited' and ${activities.meta}->>'visited' = 'true'))`,
        ),
      )
      .groupBy(activities.authorId);
    const wonKeys = (await listStages(subject.companyId)).filter((s) => s.kind === "won").map((s) => s.key);
    const wonRows = wonKeys.length
      ? await db
          .select({ ownerId: leads.ownerId, n: sql<number>`count(*)::int`, value: sql<number>`coalesce(sum(${leads.estimatedValue}), 0)::int` })
          .from(leads)
          .where(and(eq(leads.companyId, subject.companyId), alive, inArray(leads.ownerId, ids), inArray(leads.status, wonKeys), gte(leads.closedAt, from), lt(leads.closedAt, to)))
          .groupBy(leads.ownerId)
      : [];

    const items = people.map((p) => {
      const t = targets.find((x) => x.userId === p.userId);
      const visits = visitRows.find((v) => v.authorId === p.userId)?.n ?? 0;
      const won = wonRows.find((w) => w.ownerId === p.userId);
      const target = { visits: t?.targetVisits ?? 0, won: t?.targetWon ?? 0, value: t?.targetValue ?? 0 };
      const done = { visits, won: won?.n ?? 0, value: won?.value ?? 0 };
      return { userId: p.userId, name: p.name, target, done, percent: { visits: percent(done.visits, target.visits), won: percent(done.won, target.won), value: percent(done.value, target.value) } };
    });
    return { month, items: items.sort((a, b) => a.name.localeCompare(b.name)) };
  });

  // Fixer (ou remplacer) les objectifs d'une personne pour un mois.
  app.put("/objectives", { preHandler: requirePermission("objective:update") }, async (req, reply) => {
    const body = putBody.safeParse(req.body);
    const month = body.success ? monthStart(body.data.month) : null;
    if (!body.success || !month) return reply.code(400).send({ error: "invalid_body", issues: body.success ? [{ message: "mois invalide (AAAA-MM)", path: ["month"] }] : body.error.issues });
    const { subject } = req.member!;
    const [member] = await db.select({ name: users.name }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(and(eq(memberships.companyId, subject.companyId), eq(memberships.userId, body.data.userId)));
    if (!member) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "personne introuvable dans l'entreprise", path: ["userId"] }] });
    const values = { companyId: subject.companyId, userId: body.data.userId, month, targetVisits: body.data.targetVisits, targetWon: body.data.targetWon, targetValue: body.data.targetValue };
    await db.insert(objectives).values(values).onConflictDoUpdate({ target: [objectives.companyId, objectives.userId, objectives.month], set: { targetVisits: values.targetVisits, targetWon: values.targetWon, targetValue: values.targetValue, updatedAt: new Date() } });
    req.auditLabel = `${member.name} · ${month.slice(0, 7)}`;
    return reply.code(204).send();
  });
}

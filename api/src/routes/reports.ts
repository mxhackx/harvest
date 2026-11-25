import type { FastifyInstance } from "fastify";
import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { activities, leads, tasks, users } from "../db/schema.js";
import { can } from "../rbac/policy.js";
import { scopeCondition } from "../rbac/sql.js";
import { alive } from "../leads/access.js";
import { requirePermission } from "../plugins/auth.js";
import { funnel, pipelineByStage, type Move } from "../reports/compute.js";
import { listStages } from "../stages/store.js";
import { forecastByMonth, kpis } from "../reports/forecast.js";

const DAY = 24 * 3600 * 1000;
const date = z.string().datetime({ offset: true }).transform((v) => new Date(v));
const query = z.object({ from: date.optional(), to: date.optional() });

type Rep = {
  userId: string;
  name: string;
  leadsCreated: number;
  calls: number;
  messages: number;
  visits: number;
  emails: number;
  notes: number;
  stageChanges: number;
  won: number;
  wonValue: number;
  tasksDone: number;
};

/**
 * Rapports d'un responsable : pipeline en valeur, entonnoir de conversion par étape, activité par personne.
 * Les chiffres portent uniquement sur les leads que l'utilisateur a le droit de lire : un Prospecteur voit les siens,
 * un Manager ceux de l'entreprise. Aucun droit supplémentaire à gérer, et aucune fuite possible.
 */
export async function reportRoutes(app: FastifyInstance) {
  // Prévision de chiffre d'affaires (affaires en cours par mois de conclusion espérée) et indicateurs de performance.
  app.get("/reports/forecast", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const q = query.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query", issues: q.error.issues });
    const to = q.data.to ?? new Date();
    const from = q.data.from ?? new Date(to.getTime() - 30 * DAY);
    const { subject } = req.member!;
    const scope = and(scopeCondition(leads, subject, "lead:read")!, alive)!;
    const stages = await listStages(subject.companyId);
    const rows = await db
      .select({ status: leads.status, estimatedValue: leads.estimatedValue, probability: leads.probability, expectedCloseOn: leads.expectedCloseOn, createdAt: leads.createdAt, closedAt: leads.closedAt, ownerId: leads.ownerId })
      .from(leads)
      .where(scope);
    const forecast = forecastByMonth(rows, stages);
    const k = kpis(rows, stages, from, to);
    // chiffre d'affaires gagné par commercial sur la période
    const wonKeys = new Set(stages.filter((s) => s.kind === "won").map((s) => s.key));
    const byOwner = new Map<string, { won: number; wonValue: number }>();
    for (const l of rows) {
      if (!l.closedAt || l.closedAt < from || l.closedAt >= to || !wonKeys.has(l.status)) continue;
      const r = byOwner.get(l.ownerId) ?? { won: 0, wonValue: 0 };
      r.won++;
      r.wonValue += l.estimatedValue ?? 0;
      byOwner.set(l.ownerId, r);
    }
    const names = byOwner.size ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [...byOwner.keys()])) : [];
    const byRep = [...byOwner.entries()].map(([userId, r]) => ({ userId, name: names.find((n) => n.id === userId)?.name ?? "", ...r })).sort((a, b) => b.wonValue - a.wonValue);
    return { period: { from: from.toISOString(), to: to.toISOString() }, forecast, kpis: k, byRep };
  });

  app.get("/reports", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const q = query.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query", issues: q.error.issues });
    const to = q.data.to ?? new Date();
    const from = q.data.from ?? new Date(to.getTime() - 30 * DAY);
    if (!(to > from) || to.getTime() - from.getTime() > 366 * DAY) {
      return reply.code(400).send({ error: "invalid_query", issues: [{ message: "période invalide (1 à 366 jours)", path: ["from"] }] });
    }
    const { subject } = req.member!;
    const scope = and(scopeCondition(leads, subject, "lead:read")!, alive)!;
    const stages = await listStages(subject.companyId);
    const wonKeys = new Set(stages.filter((s) => s.kind === "won").map((s) => s.key));
    const inPeriod = (col: typeof leads.createdAt | typeof leads.closedAt) => and(gte(col, from), lt(col, to));

    const all = await db
      .select({ id: leads.id, status: leads.status, estimatedValue: leads.estimatedValue, probability: leads.probability, ownerId: leads.ownerId, createdAt: leads.createdAt, closedAt: leads.closedAt, lostReason: leads.lostReason })
      .from(leads)
      .where(scope);
    const cohort = all.filter((l) => l.createdAt >= from && l.createdAt < to);
    const closedInPeriod = all.filter((l) => l.closedAt && l.closedAt >= from && l.closedAt < to);

    const moveRows = await db
      .select({ leadId: activities.leadId, meta: activities.meta })
      .from(activities)
      .innerJoin(leads, eq(leads.id, activities.leadId))
      .where(and(scope, eq(activities.kind, "stage_change"), inPeriod(leads.createdAt)));
    const moves: Move[] = moveRows.map((m) => {
      const meta = (m.meta ?? {}) as { from?: { key?: string }; to?: { key?: string } };
      return { leadId: m.leadId, from: meta.from?.key ?? null, to: meta.to?.key ?? null };
    });

    // Activité : chaque entrée du fil des leads lisibles, par auteur et par type, sur la période.
    const counts = await db
      .select({ authorId: activities.authorId, kind: activities.kind, n: sql<number>`count(*)::int` })
      .from(activities)
      .innerJoin(leads, eq(leads.id, activities.leadId))
      .where(and(scope, gte(activities.occurredAt, from), lt(activities.occurredAt, to)))
      .groupBy(activities.authorId, activities.kind);

    const reps = new Map<string, Rep>();
    const rep = (userId: string): Rep => {
      let r = reps.get(userId);
      if (!r) reps.set(userId, (r = { userId, name: "", leadsCreated: 0, calls: 0, messages: 0, visits: 0, emails: 0, notes: 0, stageChanges: 0, won: 0, wonValue: 0, tasksDone: 0 }));
      return r;
    };
    const KEY = { created: "leadsCreated", call: "calls", message: "messages", visit: "visits", email: "emails", note: "notes", stage_change: "stageChanges" } as const;
    for (const c of counts) {
      const key = KEY[c.kind as keyof typeof KEY];
      if (key) rep(c.authorId)[key] += c.n;
    }
    for (const l of closedInPeriod) {
      if (wonKeys.has(l.status)) {
        const r = rep(l.ownerId);
        r.won++;
        r.wonValue += l.estimatedValue ?? 0;
      }
    }
    // Tâches terminées : seulement avec le droit de lire les tâches, et dans sa portée.
    if (can(subject, "task:read")) {
      const done = await db
        .select({ ownerId: tasks.ownerId, n: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(scopeCondition(tasks, subject, "task:read")!, isNotNull(tasks.doneAt), gte(tasks.doneAt, from), lt(tasks.doneAt, to)))
        .groupBy(tasks.ownerId);
      for (const d of done) rep(d.ownerId).tasksDone += d.n;
    }
    const ids = [...reps.keys()];
    const names = ids.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)) : [];
    for (const n of names) reps.get(n.id)!.name = n.name;

    const reasons = new Map<string, number>();
    for (const l of closedInPeriod) {
      if (stages.find((s) => s.key === l.status)?.kind !== "lost") continue;
      const reason = l.lostReason.trim() || "Non précisé";
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    const wonNow = closedInPeriod.filter((l) => wonKeys.has(l.status));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      pipeline: pipelineByStage(stages, all),
      funnel: funnel(stages, cohort, moves),
      closed: {
        won: wonNow.length,
        wonValue: wonNow.reduce((n, l) => n + (l.estimatedValue ?? 0), 0),
        lost: [...reasons.values()].reduce((a, b) => a + b, 0),
        lostReasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      },
      reps: [...reps.values()].filter((r) => r.name).sort((a, b) => b.wonValue - a.wonValue || b.leadsCreated - a.leadsCreated || a.name.localeCompare(b.name)),
    };
  });
}

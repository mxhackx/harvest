import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { leads, memberships, notifications, tasks, users } from "../db/schema.js";
import { findReadableLead, leadAttrs } from "../leads/access.js";
import { can, type Subject } from "../rbac/policy.js";
import { scopeCondition } from "../rbac/sql.js";
import { requirePermission } from "../plugins/auth.js";

const uuid = z.string().uuid();
const date = z.string().datetime({ offset: true }).transform((v) => new Date(v));

const fields = z.object({
  title: z.string().trim().min(1).max(200),
  dueAt: date.nullable(),
  leadId: uuid.nullable(),
  assigneeId: uuid,
  done: z.boolean(),
  priority: z.enum(["low", "normal", "high"]),
});
const createBody = fields.partial().required({ title: true });
const patchBody = fields.partial();
const listQuery = z.object({
  status: z.enum(["open", "done", "overdue", "all"]).default("open"),
  leadId: uuid.optional(),
  assigneeId: uuid.optional(),
});

const taskAttrs = (t: { companyId: string; ownerId: string; teamId: string | null }) => ({
  companyId: t.companyId,
  ownerId: t.ownerId,
  teamId: t.teamId,
});

/**
 * Membre de l'entreprise à qui on a le droit d'attribuer une tâche : soi-même toujours ; un autre membre
 * seulement avec `task:assign`, dans la portée de ce droit (own = personne d'autre, team = son équipe, company = tous).
 */
async function assignableMember(subject: Subject, userId: string) {
  const [m] = await db
    .select({ userId: memberships.userId, teamId: memberships.teamId, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.companyId, subject.companyId), eq(memberships.userId, userId)))
    .limit(1);
  if (!m) return null;
  if (m.userId === subject.userId) return m;
  return can(subject, "task:assign", { companyId: subject.companyId, ownerId: m.userId, teamId: m.teamId }) ? m : null;
}

async function findTask(subject: Subject, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [t] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.companyId, subject.companyId)))
    .limit(1);
  // hors de la portée de lecture : « introuvable », pas « interdit »
  return t && can(subject, "task:read", taskAttrs(t)) ? t : null;
}

const invalidAssignee = { error: "invalid_body", issues: [{ message: "personne introuvable ou non attribuable", path: ["assigneeId"] }] };
const invalidLead = { error: "invalid_body", issues: [{ message: "lead introuvable", path: ["leadId"] }] };

export async function taskRoutes(app: FastifyInstance) {
  app.get("/tasks", { preHandler: requirePermission("task:read") }, async (req, reply) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query", issues: q.error.issues });
    const { subject } = req.member!;
    // une tâche rattachée à un lead de la corbeille disparaît avec lui (et revient s'il est restauré)
    const conds = [scopeCondition(tasks, subject, "task:read")!, or(isNull(tasks.leadId), isNull(leads.deletedAt))!];
    if (q.data.status === "open") conds.push(isNull(tasks.doneAt));
    if (q.data.status === "done") conds.push(isNotNull(tasks.doneAt));
    if (q.data.status === "overdue") conds.push(isNull(tasks.doneAt), lt(tasks.dueAt, sql`now()`));
    if (q.data.leadId) conds.push(eq(tasks.leadId, q.data.leadId));
    if (q.data.assigneeId) conds.push(eq(tasks.ownerId, q.data.assigneeId));
    const rows = await db
      .select({
        task: tasks,
        assigneeName: users.name,
        lead: { name: leads.name, ownerId: leads.ownerId, teamId: leads.teamId, companyId: leads.companyId },
      })
      .from(tasks)
      .innerJoin(users, eq(users.id, tasks.ownerId))
      .leftJoin(leads, eq(leads.id, tasks.leadId))
      .where(and(...conds))
      // les plus urgentes d'abord, celles sans échéance en dernier ; les terminées, de la plus récente à la plus ancienne
      .orderBy(q.data.status === "done" ? desc(tasks.doneAt) : sql`${tasks.dueAt} asc nulls last`, sql`case ${tasks.priority} when 'high' then 0 when 'normal' then 1 else 2 end`, asc(tasks.createdAt))
      .limit(500);
    return rows.map(({ task, assigneeName, lead }) => ({
      ...task,
      assigneeName,
      // le nom du lead n'est révélé que si l'utilisateur a le droit de le lire
      leadName: lead && can(subject, "lead:read", leadAttrs(lead)) ? lead.name : null,
    }));
  });

  app.post("/tasks", { preHandler: requirePermission("task:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    if (body.data.leadId && !(await findReadableLead(subject, body.data.leadId))) return reply.code(400).send(invalidLead);
    const assignee = await assignableMember(subject, body.data.assigneeId ?? subject.userId);
    if (!assignee) return reply.code(400).send(invalidAssignee);
    const [created] = await db
      .insert(tasks)
      .values({
        companyId: subject.companyId,
        ownerId: assignee.userId,
        teamId: assignee.teamId,
        createdBy: subject.userId,
        leadId: body.data.leadId ?? null,
        title: body.data.title,
        dueAt: body.data.dueAt ?? null,
        doneAt: body.data.done ? new Date() : null,
        priority: body.data.priority ?? "normal",
      })
      .returning();
    if (assignee.userId !== subject.userId) {
      await db.insert(notifications).values({
        companyId: subject.companyId,
        userId: assignee.userId,
        kind: "task_assigned",
        title: `${req.user!.name} vous a confié : ${created.title}`,
        leadId: created.leadId,
        taskId: created.id,
      });
    }
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>("/tasks/:id", { preHandler: requirePermission("task:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success || Object.keys(body.data).length === 0) {
      return reply.code(400).send({ error: "invalid_body", issues: body.success ? [] : body.error.issues });
    }
    const { subject } = req.member!;
    const task = await findTask(subject, req.params.id);
    if (!task) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "task:update", taskAttrs(task))) return reply.code(403).send({ error: "forbidden" });
    if (body.data.leadId && !(await findReadableLead(subject, body.data.leadId))) return reply.code(400).send(invalidLead);

    const set: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
    if (body.data.title !== undefined) set.title = body.data.title;
    if (body.data.dueAt !== undefined) {
      set.dueAt = body.data.dueAt;
      if (body.data.dueAt?.getTime() !== task.dueAt?.getTime()) set.remindedAt = null; // nouvelle échéance : nouveau rappel
    }
    if (body.data.leadId !== undefined) set.leadId = body.data.leadId;
    if (body.data.priority !== undefined) set.priority = body.data.priority;
    if (body.data.done !== undefined) set.doneAt = body.data.done ? (task.doneAt ?? new Date()) : null;
    let newAssignee: string | null = null;
    if (body.data.assigneeId !== undefined && body.data.assigneeId !== task.ownerId) {
      const assignee = await assignableMember(subject, body.data.assigneeId);
      if (!assignee) return reply.code(400).send(invalidAssignee);
      set.ownerId = assignee.userId;
      set.teamId = assignee.teamId;
      if (assignee.userId !== subject.userId) newAssignee = assignee.userId;
    }
    const [updated] = await db.update(tasks).set(set).where(eq(tasks.id, task.id)).returning();
    if (newAssignee) {
      await db.insert(notifications).values({
        companyId: subject.companyId,
        userId: newAssignee,
        kind: "task_assigned",
        title: `${req.user!.name} vous a confié : ${updated.title}`,
        leadId: updated.leadId,
        taskId: updated.id,
      });
    }
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/tasks/:id", { preHandler: requirePermission("task:delete") }, async (req, reply) => {
    const { subject } = req.member!;
    const task = await findTask(subject, req.params.id);
    if (!task) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "task:delete", taskAttrs(task))) return reply.code(403).send({ error: "forbidden" });
    await db.delete(tasks).where(eq(tasks.id, task.id));
    return reply.code(204).send();
  });
}

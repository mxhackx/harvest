import type { FastifyInstance } from "fastify";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { events, leads, membershipRoles, memberships, rolePermissions, roles, tasks, teams, users } from "../db/schema.js";
import { exceedsOwnRights } from "../rbac/policy.js";
import { requirePermission } from "../plugins/auth.js";

const uuid = z.string().uuid();

/** Rôles de l'entreprise (jamais d'une autre) + vérif anti-escalade. */
export async function resolveRoles(subject: { companyId: string; grants: any }, roleIds: string[], actor: any) {
  const found = roleIds.length
    ? await db
        .select()
        .from(roles)
        .where(and(inArray(roles.id, roleIds), eq(roles.companyId, subject.companyId)))
    : [];
  if (found.length !== new Set(roleIds).size) return { error: "unknown_role" as const };
  const grants = found.length
    ? await db
        .select({ permission: rolePermissions.permission, scope: rolePermissions.scope })
        .from(rolePermissions)
        .where(inArray(rolePermissions.roleId, found.map((r) => r.id)))
    : [];
  if (exceedsOwnRights(actor, grants).length) return { error: "privilege_escalation" as const };
  return { roles: found };
}

async function otherCeoCount(companyId: string, excludeMembershipId: string) {
  const rows = await db
    .select({ id: membershipRoles.membershipId })
    .from(membershipRoles)
    .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
    .where(
      and(
        eq(roles.companyId, companyId),
        eq(roles.key, "ceo"),
        ne(membershipRoles.membershipId, excludeMembershipId),
      ),
    );
  return rows.length;
}

async function findMember(companyId: string, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, id), eq(memberships.companyId, companyId)))
    .limit(1);
  return m ?? null;
}

export async function memberRoutes(app: FastifyInstance) {
  app.get("/members", { preHandler: requirePermission("member:read") }, async (req) => {
    const companyId = req.member!.subject.companyId;
    const rows = await db
      .select({
        id: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        teamId: memberships.teamId,
        roleId: membershipRoles.roleId,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(membershipRoles, eq(membershipRoles.membershipId, memberships.id))
      .where(eq(memberships.companyId, companyId));
    const byId = new Map<string, any>();
    for (const r of rows) {
      const m = byId.get(r.id) ?? { id: r.id, userId: r.userId, name: r.name, email: r.email, teamId: r.teamId, roleIds: [] };
      if (r.roleId) m.roleIds.push(r.roleId);
      byId.set(r.id, m);
    }
    return [...byId.values()];
  });

  const addBody = z.object({
    email: z.string().trim().toLowerCase().email(),
    roleIds: z.array(uuid).min(1).max(20),
    teamId: uuid.nullable().optional(),
  });

  // Ajoute un compte déjà inscrit. L'invitation par e-mail d'un inconnu viendra plus tard.
  app.post("/members", { preHandler: requirePermission("member:create") }, async (req, reply) => {
    const body = addBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { subject } = req.member!;
    const r = await resolveRoles(subject, body.data.roleIds, subject);
    if ("error" in r) return reply.code(r.error === "unknown_role" ? 400 : 403).send({ error: r.error });
    if (body.data.teamId) {
      const [t] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.id, body.data.teamId), eq(teams.companyId, subject.companyId)));
      if (!t) return reply.code(400).send({ error: "unknown_team" });
    }
    const [user] = await db.select().from(users).where(eq(users.email, body.data.email)).limit(1);
    if (!user) return reply.code(404).send({ error: "user_not_found" });
    const [dup] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.companyId, subject.companyId)));
    if (dup) return reply.code(409).send({ error: "already_member" });
    const member = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(memberships)
        .values({ userId: user.id, companyId: subject.companyId, teamId: body.data.teamId ?? null })
        .returning();
      await tx.insert(membershipRoles).values(r.roles.map((x) => ({ membershipId: m.id, roleId: x.id })));
      return m;
    });
    return reply.code(201).send(member);
  });

  app.put<{ Params: { id: string } }>("/members/:id/roles", { preHandler: requirePermission("member:update") }, async (req, reply) => {
    const body = z.object({ roleIds: z.array(uuid).min(1).max(20) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { subject } = req.member!;
    const target = await findMember(subject.companyId, req.params.id);
    if (!target) return reply.code(404).send({ error: "not_found" });
    const r = await resolveRoles(subject, body.data.roleIds, subject);
    if ("error" in r) return reply.code(r.error === "unknown_role" ? 400 : 403).send({ error: r.error });
    // On ne retire pas non plus des droits qu'on n'a pas soi-même (ex. un manager ne rétrograde pas le CEO).
    const currentRoles = await db
      .select({ roleId: membershipRoles.roleId })
      .from(membershipRoles)
      .where(eq(membershipRoles.membershipId, target.id));
    const cur = await resolveRoles(subject, currentRoles.map((x) => x.roleId), subject);
    if ("error" in cur) return reply.code(403).send({ error: "privilege_escalation" });
    const keepsCeo = r.roles.some((x) => x.key === "ceo");
    if (!keepsCeo && (await otherCeoCount(subject.companyId, target.id)) === 0)
      return reply.code(409).send({ error: "last_ceo" });
    await db.transaction(async (tx) => {
      await tx.delete(membershipRoles).where(eq(membershipRoles.membershipId, target.id));
      await tx.insert(membershipRoles).values(r.roles.map((x) => ({ membershipId: target.id, roleId: x.id })));
    });
    return { id: target.id, roleIds: r.roles.map((x) => x.id) };
  });

  app.put<{ Params: { id: string } }>("/members/:id/team", { preHandler: requirePermission("member:update") }, async (req, reply) => {
    const body = z.object({ teamId: uuid.nullable() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { subject } = req.member!;
    const target = await findMember(subject.companyId, req.params.id);
    if (!target) return reply.code(404).send({ error: "not_found" });
    if (body.data.teamId) {
      const [t] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.id, body.data.teamId), eq(teams.companyId, subject.companyId)));
      if (!t) return reply.code(400).send({ error: "unknown_team" });
    }
    await db.transaction(async (tx) => {
      await tx.update(memberships).set({ teamId: body.data.teamId }).where(eq(memberships.id, target.id));
      // la portée « team » des leads, tâches et rendez-vous de cette personne la suit dans sa nouvelle équipe
      const mine = (t: { companyId: any; ownerId: any }) => and(eq(t.companyId, subject.companyId), eq(t.ownerId, target.userId));
      await tx.update(leads).set({ teamId: body.data.teamId }).where(mine(leads));
      await tx.update(tasks).set({ teamId: body.data.teamId }).where(mine(tasks));
      await tx.update(events).set({ teamId: body.data.teamId }).where(mine(events));
    });
    return { id: target.id, teamId: body.data.teamId };
  });

  app.delete<{ Params: { id: string } }>("/members/:id", { preHandler: requirePermission("member:delete") }, async (req, reply) => {
    const { subject } = req.member!;
    const target = await findMember(subject.companyId, req.params.id);
    if (!target) return reply.code(404).send({ error: "not_found" });
    const currentRoles = await db
      .select({ roleId: membershipRoles.roleId })
      .from(membershipRoles)
      .where(eq(membershipRoles.membershipId, target.id));
    const cur = await resolveRoles(subject, currentRoles.map((x) => x.roleId), subject);
    if ("error" in cur) return reply.code(403).send({ error: "privilege_escalation" });
    if (cur.roles.some((x) => x.key === "ceo") && (await otherCeoCount(subject.companyId, target.id)) === 0)
      return reply.code(409).send({ error: "last_ceo" });
    await db.delete(memberships).where(eq(memberships.id, target.id));
    return reply.code(204).send();
  });
}

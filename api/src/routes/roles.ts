import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { membershipRoles, rolePermissions, roles } from "../db/schema.js";
import { CATALOG, SYSTEM_ROLES, isScoped, isValidPermission, type Grant } from "../rbac/permissions.js";
import { exceedsOwnRights } from "../rbac/policy.js";
import { requirePermission, requireMember } from "../plugins/auth.js";

const grantsSchema = z
  .array(z.object({ permission: z.string(), scope: z.enum(["own", "team", "company"]) }))
  .max(200)
  .superRefine((list, ctx) => {
    for (const g of list)
      if (!isValidPermission(g.permission))
        ctx.addIssue({ code: "custom", message: `permission inconnue : ${g.permission}` });
  })
  // Une permission non scopée (ex. role:update) vaut toujours « company ».
  .transform((list): Grant[] => {
    const byPerm = new Map<string, Grant>();
    for (const g of list) byPerm.set(g.permission, { ...g, scope: isScoped(g.permission) ? g.scope : "company" });
    return [...byPerm.values()];
  });

const createBody = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).default(""),
  grants: grantsSchema,
});
const patchBody = createBody.partial();

async function findRole(companyId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, id), eq(roles.companyId, companyId)))
    .limit(1);
  return r ?? null;
}
async function roleGrants(roleId: string): Promise<Grant[]> {
  const rows = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  return rows.map((r) => ({ permission: r.permission, scope: r.scope }));
}
async function replaceGrants(roleId: string, grants: Grant[]) {
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (grants.length) await tx.insert(rolePermissions).values(grants.map((g) => ({ roleId, ...g })));
  });
}

export async function roleRoutes(app: FastifyInstance) {
  app.get("/permissions", { preHandler: requireMember }, async () => CATALOG);

  app.get("/roles", { preHandler: requirePermission("role:read") }, async (req) => {
    const companyId = req.member!.subject.companyId;
    const list = await db.select().from(roles).where(eq(roles.companyId, companyId));
    const perms = await db
      .select({ roleId: rolePermissions.roleId, permission: rolePermissions.permission, scope: rolePermissions.scope })
      .from(rolePermissions)
      .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
      .where(eq(roles.companyId, companyId));
    const counts = await db
      .select({ roleId: membershipRoles.roleId, n: sql<number>`count(*)::int` })
      .from(membershipRoles)
      .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(eq(roles.companyId, companyId))
      .groupBy(membershipRoles.roleId);
    return list.map((r) => ({
      ...r,
      memberCount: counts.find((c) => c.roleId === r.id)?.n ?? 0,
      grants: perms.filter((p) => p.roleId === r.id).map(({ permission, scope }) => ({ permission, scope })),
    }));
  });

  app.post("/roles", { preHandler: requirePermission("role:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const over = exceedsOwnRights(subject, body.data.grants);
    if (over.length) return reply.code(403).send({ error: "privilege_escalation", permissions: over });
    const [role] = await db
      .insert(roles)
      .values({
        companyId: subject.companyId,
        key: `custom-${randomUUID().slice(0, 8)}`,
        name: body.data.name,
        description: body.data.description,
      })
      .returning();
    await replaceGrants(role.id, body.data.grants);
    return reply.code(201).send({ ...role, grants: body.data.grants });
  });

  app.patch<{ Params: { id: string } }>("/roles/:id", { preHandler: requirePermission("role:update") }, async (req, reply) => {
    const { subject } = req.member!;
    const role = await findRole(subject.companyId, req.params.id);
    if (!role) return reply.code(404).send({ error: "not_found" });
    if (role.key === "ceo") return reply.code(403).send({ error: "ceo_role_locked" });
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    // On ne modifie pas un rôle plus puissant que soi, ni n'accorde plus que ce qu'on a.
    const current = await roleGrants(role.id);
    if (exceedsOwnRights(subject, current).length || exceedsOwnRights(subject, body.data.grants ?? []).length) {
      return reply.code(403).send({ error: "privilege_escalation" });
    }
    const patch: Partial<typeof roles.$inferInsert> = {};
    if (body.data.description !== undefined) patch.description = body.data.description;
    if (body.data.name !== undefined && !role.isSystem) patch.name = body.data.name;
    if (Object.keys(patch).length) await db.update(roles).set(patch).where(eq(roles.id, role.id));
    if (body.data.grants) await replaceGrants(role.id, body.data.grants);
    return { ...role, ...patch, grants: body.data.grants ?? current };
  });

  app.post<{ Params: { id: string } }>("/roles/:id/reset", { preHandler: requirePermission("role:update") }, async (req, reply) => {
    const { subject } = req.member!;
    const role = await findRole(subject.companyId, req.params.id);
    const tpl = role && SYSTEM_ROLES.find((s) => s.key === role.key);
    if (!role || !tpl) return reply.code(404).send({ error: "not_found" });
    if (role.key === "ceo") return reply.code(403).send({ error: "ceo_role_locked" });
    if (exceedsOwnRights(subject, tpl.grants).length) return reply.code(403).send({ error: "privilege_escalation" });
    await replaceGrants(role.id, tpl.grants);
    return { ...role, grants: tpl.grants };
  });

  app.delete<{ Params: { id: string } }>("/roles/:id", { preHandler: requirePermission("role:delete") }, async (req, reply) => {
    const { subject } = req.member!;
    const role = await findRole(subject.companyId, req.params.id);
    if (!role) return reply.code(404).send({ error: "not_found" });
    if (role.isSystem) return reply.code(403).send({ error: "system_role" });
    if (exceedsOwnRights(subject, await roleGrants(role.id)).length)
      return reply.code(403).send({ error: "privilege_escalation" });
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(membershipRoles)
      .where(eq(membershipRoles.roleId, role.id));
    if (n > 0) return reply.code(409).send({ error: "role_in_use", members: n });
    await db.delete(roles).where(eq(roles.id, role.id));
    return reply.code(204).send();
  });
}

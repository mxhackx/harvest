import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { memberships, membershipRoles, rolePermissions } from "../db/schema.js";
import { SESSION_COOKIE, resolveSession } from "../auth/session.js";
import { can, mergeGrants, type Subject } from "../rbac/policy.js";
import type { Scope } from "../rbac/permissions.js";

export type AuthUser = { id: string; email: string; name: string; image: string | null; emailReminders: boolean };
export type MemberCtx = { membershipId: string; subject: Subject; roleIds: string[] };

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    member: MemberCtx | null;
  }
}

/** Lit le cookie de session et pose request.user. */
export async function loadUser(req: FastifyRequest) {
  req.user = null;
  req.member = null;
  const token = req.cookies[SESSION_COOKIE];
  if (token) req.user = await resolveSession(db, token);
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) return reply.code(401).send({ error: "unauthenticated" });
}

export async function loadMembership(userId: string, companyId: string): Promise<MemberCtx | null> {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.companyId, companyId)))
    .limit(1);
  if (!m) return null;
  const rows = await db
    .select({
      roleId: membershipRoles.roleId,
      permission: rolePermissions.permission,
      scope: rolePermissions.scope,
    })
    .from(membershipRoles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, membershipRoles.roleId))
    .where(eq(membershipRoles.membershipId, m.id));
  const grants = mergeGrants([
    rows
      .filter((r) => r.permission)
      .map((r) => ({ permission: r.permission!, scope: r.scope as Scope })),
  ]);
  return {
    membershipId: m.id,
    roleIds: [...new Set(rows.map((r) => r.roleId))],
    subject: { userId, companyId, teamId: m.teamId, grants },
  };
}

/** Résout l'entreprise active : en-tête X-Company-Id, sinon l'unique appartenance. */
export async function requireMember(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) return reply.code(401).send({ error: "unauthenticated" });
  let companyId = req.headers["x-company-id"];
  if (Array.isArray(companyId)) companyId = companyId[0];
  if (!companyId) {
    const mine = await db
      .select({ c: memberships.companyId })
      .from(memberships)
      .where(eq(memberships.userId, req.user.id));
    if (mine.length !== 1) return reply.code(400).send({ error: "company_required" });
    companyId = mine[0].c;
  }
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return reply.code(400).send({ error: "company_required" });
  const ctx = await loadMembership(req.user.id, companyId);
  // Même réponse que « pas de droit » : on ne révèle pas l'existence d'une entreprise.
  if (!ctx) return reply.code(403).send({ error: "forbidden" });
  req.member = ctx;
}

export const requirePermission = (permission: string) => async (req: FastifyRequest, reply: FastifyReply) => {
  await requireMember(req, reply);
  if (reply.sent) return;
  if (!can(req.member!.subject, permission)) {
    return reply.code(403).send({ error: "forbidden", permission });
  }
};

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, type Db } from "../db/index.js";
import { companies, membershipRoles, memberships, rolePermissions, roles, teams } from "../db/schema.js";
import { SYSTEM_ROLES } from "../rbac/permissions.js";
import { requirePermission, requireUser } from "../plugins/auth.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Crée l'entreprise, ses rôles système, sa première équipe, et fait du créateur le CEO. */
export async function createCompanyWithDefaults(
  tx: Tx,
  input: { userId: string; name: string; sector: string; region: string; teamName: string },
) {
  const [company] = await tx
    .insert(companies)
    .values({ name: input.name, sector: input.sector, region: input.region, createdBy: input.userId })
    .returning();
  const [team] = await tx.insert(teams).values({ companyId: company.id, name: input.teamName }).returning();

  const createdRoles = await tx
    .insert(roles)
    .values(
      SYSTEM_ROLES.map((r) => ({
        companyId: company.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: true,
      })),
    )
    .returning();
  await tx.insert(rolePermissions).values(
    createdRoles.flatMap((role) =>
      SYSTEM_ROLES.find((s) => s.key === role.key)!.grants.map((g) => ({ roleId: role.id, ...g })),
    ),
  );

  const [member] = await tx
    .insert(memberships)
    .values({ userId: input.userId, companyId: company.id, teamId: team.id })
    .returning();
  await tx.insert(membershipRoles).values({
    membershipId: member.id,
    roleId: createdRoles.find((r) => r.key === "ceo")!.id,
  });
  return { company, team };
}

const companyBody = z.object({
  name: z.string().trim().min(1).max(100),
  sector: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  teamName: z.string().trim().min(1).max(100),
});

export async function companyRoutes(app: FastifyInstance) {
  app.post("/companies", { preHandler: requireUser }, async (req, reply) => {
    const body = companyBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const result = await db.transaction((tx) =>
      createCompanyWithDefaults(tx, { userId: req.user!.id, ...body.data }),
    );
    return reply.code(201).send(result);
  });

  app.get("/teams", { preHandler: requirePermission("team:read") }, async (req) =>
    db.select().from(teams).where(eq(teams.companyId, req.member!.subject.companyId)),
  );

  app.post("/teams", { preHandler: requirePermission("team:create") }, async (req, reply) => {
    const body = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const [team] = await db
      .insert(teams)
      .values({ companyId: req.member!.subject.companyId, name: body.data.name })
      .returning();
    return reply.code(201).send(team);
  });
}

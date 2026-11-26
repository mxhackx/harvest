import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type Db } from "../db/index.js";
import { companies, membershipRoles, memberships, pipelineStages, rolePermissions, roles, teams } from "../db/schema.js";
import { DEFAULT_STAGES } from "../stages/defaults.js";
import { SYSTEM_ROLES } from "../rbac/permissions.js";
import { requirePermission, requireUser } from "../plugins/auth.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Crée l'entreprise, ses rôles système, sa première équipe, et fait du créateur le CEO. */
export async function createCompanyWithDefaults(
  tx: Tx,
  input: { userId: string; name: string; sector: string; region: string; teamName: string; email?: string; phone?: string; logo?: string },
) {
  const [company] = await tx
    .insert(companies)
    .values({ name: input.name, sector: input.sector, region: input.region, email: input.email, phone: input.phone, logo: input.logo, createdBy: input.userId })
    .returning();
  await tx.insert(pipelineStages).values(DEFAULT_STAGES.map((s, i) => ({ companyId: company.id, ...s, position: i })));
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

/** Photo : PNG, JPEG ou WebP en data URL (jamais de SVG, qui peut porter du script), ~110 Ko au plus. "" = pas de photo. */
export const MAX_LOGO = 150_000;
const logo = z.string().max(MAX_LOGO, "image trop lourde").regex(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*)?$/, "image PNG, JPEG ou WebP attendue");
/** Téléphone au format international (cahier des charges §5.2) : les espaces et la ponctuation sont retirés. */
const phone = z
  .string()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^(\+[1-9]\d{7,14})?$/, "numéro au format international, ex. +229 01 97 00 00 00"));
const email = z.union([z.literal(""), z.string().trim().toLowerCase().email("adresse e-mail invalide").max(200)]);

const identity = {
  name: z.string().trim().min(1).max(100),
  sector: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
};
const companyBody = z.object({ ...identity, teamName: z.string().trim().min(1).max(100), email: email.default(""), phone: phone.default(""), logo: logo.default("") });
const companyPatch = z.object({ ...identity, email, phone, logo }).partial();

export async function companyRoutes(app: FastifyInstance) {
  app.post("/companies", { preHandler: requireUser }, async (req, reply) => {
    const body = companyBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const result = await db.transaction((tx) =>
      createCompanyWithDefaults(tx, { userId: req.user!.id, ...body.data }),
    );
    return reply.code(201).send(result);
  });

  // L'entreprise active : seule celle de la requête peut être modifiée.
  app.patch("/company", { preHandler: requirePermission("company:update") }, async (req, reply) => {
    const body = companyPatch.safeParse(req.body);
    if (!body.success || Object.keys(body.data).length === 0) return reply.code(400).send({ error: "invalid_body", issues: body.success ? [] : body.error.issues });
    const [company] = await db.update(companies).set(body.data).where(eq(companies.id, req.member!.subject.companyId)).returning();
    req.auditLabel = company.name;
    return company;
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

  const teamId = z.string().uuid();
  app.patch<{ Params: { id: string } }>("/teams/:id", { preHandler: requirePermission("team:update") }, async (req, reply) => {
    const body = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(req.body);
    if (!body.success || !teamId.safeParse(req.params.id).success) return reply.code(body.success ? 404 : 400).send({ error: body.success ? "not_found" : "invalid_body" });
    const [team] = await db
      .update(teams)
      .set({ name: body.data.name })
      .where(and(eq(teams.id, req.params.id), eq(teams.companyId, req.member!.subject.companyId)))
      .returning();
    return team ?? reply.code(404).send({ error: "not_found" });
  });

  // Les membres, leads, tâches et rendez-vous de l'équipe supprimée n'ont plus d'équipe (clés étrangères « set null »).
  app.delete<{ Params: { id: string } }>("/teams/:id", { preHandler: requirePermission("team:delete") }, async (req, reply) => {
    if (!teamId.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const gone = await db
      .delete(teams)
      .where(and(eq(teams.id, req.params.id), eq(teams.companyId, req.member!.subject.companyId)))
      .returning({ id: teams.id });
    return gone.length ? reply.code(204).send() : reply.code(404).send({ error: "not_found" });
  });
}

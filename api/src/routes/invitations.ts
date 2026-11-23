import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { companies, invitations, membershipRoles, memberships, roles, teams } from "../db/schema.js";
import { requirePermission, requireUser } from "../plugins/auth.js";
import { resolveRoles } from "./members.js";

const TTL_MS = 7 * 24 * 3600 * 1000;
const uuid = z.string().uuid();
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const tokenBody = z.object({ token: z.string().min(20).max(200) });
const inviteBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  roleIds: z.array(uuid).min(1).max(20),
  teamId: uuid.nullable().optional(),
});

const stillValid = (token: string) =>
  and(eq(invitations.tokenHash, hash(token)), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()));

export async function invitationRoutes(app: FastifyInstance) {
  const strict = { rateLimit: { max: config.authRateLimit, timeWindow: "1 minute" } };

  // Invitations en attente de l'entreprise (jamais le jeton : il n'est connu que de celui qui l'a reçu à la création).
  app.get("/invitations", { preHandler: requirePermission("member:create") }, async (req) => {
    const rows = await db
      .select({ id: invitations.id, email: invitations.email, roleIds: invitations.roleIds, teamId: invitations.teamId, expiresAt: invitations.expiresAt, createdAt: invitations.createdAt })
      .from(invitations)
      .where(and(eq(invitations.companyId, req.member!.subject.companyId), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())));
    return rows;
  });

  app.post("/invitations", { preHandler: requirePermission("member:create") }, async (req, reply) => {
    const body = inviteBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const r = await resolveRoles(subject, body.data.roleIds, subject);
    if ("error" in r) return reply.code(r.error === "unknown_role" ? 400 : 403).send({ error: r.error });
    if (body.data.teamId) {
      const [t] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, body.data.teamId), eq(teams.companyId, subject.companyId)));
      if (!t) return reply.code(400).send({ error: "unknown_team" });
    }
    const already = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, body.data.email) });
    if (already) {
      const [m] = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, already.id), eq(memberships.companyId, subject.companyId)));
      if (m) return reply.code(409).send({ error: "already_member" });
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + TTL_MS);
    const created = await db.transaction(async (tx) => {
      // une seule invitation en attente par adresse : la nouvelle remplace l'ancienne (lien précédent invalidé)
      await tx.delete(invitations).where(and(eq(invitations.companyId, subject.companyId), eq(invitations.email, body.data.email), isNull(invitations.acceptedAt)));
      const [row] = await tx
        .insert(invitations)
        .values({ companyId: subject.companyId, email: body.data.email, roleIds: r.roles.map((x) => x.id), teamId: body.data.teamId ?? null, tokenHash: hash(token), invitedBy: subject.userId, expiresAt })
        .returning({ id: invitations.id, email: invitations.email, expiresAt: invitations.expiresAt });
      return row;
    });
    return reply.code(201).send({ ...created, token });
  });

  app.delete<{ Params: { id: string } }>("/invitations/:id", { preHandler: requirePermission("member:create") }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const gone = await db
      .delete(invitations)
      .where(and(eq(invitations.id, req.params.id), eq(invitations.companyId, req.member!.subject.companyId), isNull(invitations.acceptedAt)))
      .returning({ id: invitations.id });
    return gone.length ? reply.code(204).send() : reply.code(404).send({ error: "not_found" });
  });

  // Aperçu pour la page d'invitation : qui invite, à quelle adresse. Public, limité en débit, jeton secret requis.
  app.post("/invitations/preview", { config: strict }, async (req, reply) => {
    const body = tokenBody.safeParse(req.body);
    if (!body.success) return reply.code(404).send({ error: "invalid_invitation" });
    const [row] = await db
      .select({ email: invitations.email, company: companies.name })
      .from(invitations)
      .innerJoin(companies, eq(companies.id, invitations.companyId))
      .where(stillValid(body.data.token));
    return row ?? reply.code(404).send({ error: "invalid_invitation" });
  });

  app.post("/invitations/accept", { preHandler: requireUser, config: strict }, async (req, reply) => {
    const body = tokenBody.safeParse(req.body);
    if (!body.success) return reply.code(404).send({ error: "invalid_invitation" });
    const user = req.user!;
    const [inv] = await db.select().from(invitations).where(stillValid(body.data.token));
    if (!inv) return reply.code(404).send({ error: "invalid_invitation" });
    // l'invitation est nominative : le lien ne sert qu'à la personne dont c'est l'adresse
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) return reply.code(403).send({ error: "invitation_other_email" });
    const [dup] = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, user.id), eq(memberships.companyId, inv.companyId)));
    if (dup) return reply.code(409).send({ error: "already_member" });
    // les rôles ont pu être supprimés depuis l'invitation : on n'attribue que ceux qui existent encore
    const valid = await db.select({ id: roles.id }).from(roles).where(and(inArray(roles.id, inv.roleIds), eq(roles.companyId, inv.companyId)));
    if (!valid.length) return reply.code(409).send({ error: "invitation_roles_gone" });
    const [team] = inv.teamId ? await db.select({ id: teams.id }).from(teams).where(eq(teams.id, inv.teamId)) : [];
    await db.transaction(async (tx) => {
      // « accepté » est posé d'abord, sous condition : deux clics simultanés ne créent qu'un membre
      const claimed = await tx.update(invitations).set({ acceptedAt: new Date() }).where(and(eq(invitations.id, inv.id), isNull(invitations.acceptedAt))).returning({ id: invitations.id });
      if (!claimed.length) throw new Error("already_claimed");
      const [m] = await tx.insert(memberships).values({ userId: user.id, companyId: inv.companyId, teamId: team?.id ?? null }).returning();
      await tx.insert(membershipRoles).values(valid.map((x) => ({ membershipId: m.id, roleId: x.id })));
    }).catch((e) => {
      if (e instanceof Error && e.message === "already_claimed") return reply.code(404).send({ error: "invalid_invitation" });
      throw e;
    });
    if (reply.sent) return;
    return reply.code(201).send({ companyId: inv.companyId });
  });
}

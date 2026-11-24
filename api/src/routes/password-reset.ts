import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "../auth/password.js";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { passwordResets, sessions, users } from "../db/schema.js";
import { sendMail } from "../mail/send.js";
import { resetMail } from "../mail/templates.js";

const TTL_MIN = 60;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const forgotBody = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const resetBody = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(128) });

/**
 * Mot de passe oublié. La réponse à /auth/forgot est toujours la même, que l'adresse existe ou non : on ne révèle
 * pas qui a un compte. Le jeton n'est jamais stocké en clair, vaut une heure et ne sert qu'une fois ; un nouveau
 * mot de passe ferme toutes les sessions ouvertes (un voleur de session ne reste pas connecté).
 */
export async function passwordResetRoutes(app: FastifyInstance) {
  const strict = { rateLimit: { max: config.authRateLimit, timeWindow: "1 minute" } };

  app.post("/auth/forgot", { config: strict }, async (req, reply) => {
    const body = forgotBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, body.data.email)).limit(1);
    if (user) {
      const token = randomBytes(32).toString("base64url");
      // une seule demande active par compte : la nouvelle annule les précédentes
      await db.delete(passwordResets).where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
      await db.insert(passwordResets).values({ userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL_MIN * 60_000) });
      const url = `${config.appUrls[0]}/reinitialiser?token=${encodeURIComponent(token)}`;
      await sendMail(resetMail(user.email, { url, minutes: TTL_MIN }), req.log);
    }
    return reply.code(202).send({ ok: true });
  });

  app.post("/auth/reset", { config: strict }, async (req, reply) => {
    const body = resetBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const passwordHash = await hashPassword(body.data.password);
    const ok = await db.transaction(async (tx) => {
      // « used_at is null » dans le UPDATE : deux requêtes simultanées avec le même jeton, une seule passe
      const [row] = await tx
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResets.tokenHash, hash(body.data.token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
        .returning({ userId: passwordResets.userId });
      if (!row) return false;
      await tx.update(users)// recevoir le lien par e-mail prouve que l'adresse est bien la sienne
      .set({ passwordHash, emailVerified: true }).where(eq(users.id, row.userId));
      await tx.delete(sessions).where(eq(sessions.userId, row.userId));
      return true;
    });
    if (!ok) return reply.code(400).send({ error: "invalid_reset" });
    return reply.code(204).send();
  });
}

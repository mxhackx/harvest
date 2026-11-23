import type { FastifyInstance, FastifyReply } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { companies, memberships, roles, teams, users } from "../db/schema.js";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../auth/password.js";
import { SESSION_COOKIE, createSession, destroySession } from "../auth/session.js";
import {
  PROVIDERS,
  authorizationUrl,
  fetchProfile,
  isConfigured,
  randomToken,
  type Provider,
} from "../auth/oauth.js";
import { findOrCreateOAuthUser } from "../auth/oauth-user.js";
import { loadMembership, requireUser } from "../plugins/auth.js";

const OAUTH_COOKIE = "harvest_oauth";
const rate = { rateLimit: { max: config.authRateLimit, timeWindow: "1 minute" } };

const email = z.string().trim().toLowerCase().email().max(254);
const registerBody = z.object({
  email,
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
  remember: z.boolean().optional(),
});
const loginBody = z.object({
  email,
  password: z.string().min(1).max(128),
  remember: z.boolean().optional(),
});

async function startSession(reply: FastifyReply, userId: string, remember: boolean) {
  const { token, maxAgeSec } = await createSession(db, userId, remember);
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/",
    maxAge: maxAgeSec,
  });
}

const safeOrigin = (candidate: unknown): string => {
  try {
    const o = new URL(String(candidate)).origin;
    if (config.appUrls.includes(o)) return o;
  } catch {}
  return config.appUrls[0];
};

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", { config: rate }, async (req, reply) => {
    const body = registerBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { email, name, password, remember } = body.data;
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (exists) return reply.code(409).send({ error: "email_taken" });
    const [user] = await db
      .insert(users)
      .values({ email, name, passwordHash: await hashPassword(password) })
      .returning({ id: users.id });
    await startSession(reply, user.id, remember ?? false);
    return reply.code(201).send({ id: user.id, email, name });
  });

  app.post("/auth/login", { config: rate }, async (req, reply) => {
    const body = loginBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { email, password, remember } = body.data;
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // On vérifie toujours un hash pour ne pas révéler par le temps de réponse si l'e-mail existe.
    const ok = await verifyPassword(password, u?.passwordHash ?? DUMMY_HASH);
    if (!u || !u.passwordHash || !ok) return reply.code(401).send({ error: "invalid_credentials" });
    await startSession(reply, u.id, remember ?? false);
    return { id: u.id, email: u.email, name: u.name };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await destroySession(db, token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: requireUser }, async (req) => {
    const user = req.user!;
    const rows = await db
      .select({ id: companies.id, name: companies.name, sector: companies.sector, region: companies.region })
      .from(memberships)
      .innerJoin(companies, eq(companies.id, memberships.companyId))
      .where(eq(memberships.userId, user.id));
    const list = await Promise.all(
      rows.map(async (c) => {
        const ctx = await loadMembership(user.id, c.id);
        const [{ joinedAt }] = await db
          .select({ joinedAt: memberships.createdAt })
          .from(memberships)
          .where(eq(memberships.id, ctx!.membershipId));
        const memberRoles = ctx!.roleIds.length
          ? await db.select({ id: roles.id, key: roles.key, name: roles.name }).from(roles).where(inArray(roles.id, ctx!.roleIds))
          : [];
        const [team] = ctx!.subject.teamId
          ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, ctx!.subject.teamId))
          : [];
        return {
          company: c,
          teamId: ctx!.subject.teamId,
          team: team ?? null,
          roleIds: ctx!.roleIds,
          roles: memberRoles,
          joinedAt,
          permissions: [...ctx!.subject.grants].map(([permission, scope]) => ({ permission, scope })),
        };
      }),
    );
    return { user, memberships: list };
  });

  app.get("/auth/providers", async () => ({
    email: true,
    google: isConfigured("google"),
    github: isConfigured("github"),
  }));

  // ---- OAuth : /auth/google, /auth/github puis /auth/:provider/callback ----
  const isProvider = (p: string): p is Provider => (PROVIDERS as string[]).includes(p);

  app.get<{ Params: { provider: string }; Querystring: { returnTo?: string } }>(
    "/auth/:provider",
    { config: rate },
    async (req, reply) => {
      const { provider } = req.params;
      if (!isProvider(provider)) return reply.code(404).send({ error: "unknown_provider" });
      const returnTo = safeOrigin(req.query.returnTo);
      if (!isConfigured(provider)) return reply.redirect(`${returnTo}/login?error=provider_not_configured`);
      const state = randomToken();
      const verifier = randomToken();
      reply.setCookie(OAUTH_COOKIE, JSON.stringify({ state, verifier, returnTo, provider }), {
        httpOnly: true,
        sameSite: "lax", // doit survivre à la redirection depuis Google / GitHub
        secure: config.isProd,
        path: config.oauthCookiePath,
        maxAge: 600,
      });
      return reply.redirect(authorizationUrl(provider, state, verifier));
    },
  );

  app.get<{ Params: { provider: string }; Querystring: { code?: string; state?: string } }>(
    "/auth/:provider/callback",
    { config: rate },
    async (req, reply) => {
      const { provider } = req.params;
      if (!isProvider(provider)) return reply.code(404).send({ error: "unknown_provider" });
      let saved: { state: string; verifier: string; returnTo: string; provider: string } | null = null;
      try {
        saved = JSON.parse(req.cookies[OAUTH_COOKIE] ?? "null");
      } catch {}
      reply.clearCookie(OAUTH_COOKIE, { path: config.oauthCookiePath });
      const back = safeOrigin(saved?.returnTo);
      const fail = (code: string) => reply.redirect(`${back}/login?error=${code}`);

      const { code, state } = req.query;
      if (!saved || saved.provider !== provider || !code || !state || state !== saved.state) {
        return fail("oauth_state");
      }

      try {
        const profile = await fetchProfile(provider, code, saved.verifier);
        const { userId } = await findOrCreateOAuthUser(db, provider, profile);
        await startSession(reply, userId, true);
        return reply.redirect(`${back}/`);
      } catch (err) {
        req.log.error({ err }, "oauth callback failed");
        return fail("oauth_failed");
      }
    },
  );
}

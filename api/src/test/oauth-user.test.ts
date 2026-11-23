import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "../db/index.js";
import { oauthAccounts, sessions, users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { createSession, resolveSession } from "../auth/session.js";
import { findOrCreateOAuthUser } from "../auth/oauth-user.js";

afterAll(() => client.end());
const run = Math.random().toString(36).slice(2, 8);
const profile = (n: string, extra = {}) => ({
  providerAccountId: `gh-${run}-${n}`,
  email: `oauth-${run}-${n}@test.dev`,
  emailVerified: true,
  name: "Octo",
  image: null as string | null,
  ...extra,
});

describe("findOrCreateOAuthUser", () => {
  it("crée un compte vérifié pour un nouvel e-mail, puis le retrouve", async () => {
    const p = profile("new");
    const first = await findOrCreateOAuthUser(db, "github", p);
    const again = await findOrCreateOAuthUser(db, "github", p);
    expect(again.userId).toBe(first.userId);
    const [u] = await db.select().from(users).where(eq(users.id, first.userId));
    expect(u.emailVerified).toBe(true);
    expect(u.passwordHash).toBeNull();
  });

  it("relie un compte à mot de passe existant et connecte son propriétaire", async () => {
    const p = profile("link");
    const [u] = await db
      .insert(users)
      .values({ email: p.email, name: "Moi", passwordHash: await hashPassword("secret-123") })
      .returning();
    const r = await findOrCreateOAuthUser(db, "github", p);
    expect(r.userId).toBe(u.id);
    expect(r.passwordRemoved).toBe(true);
    const links = await db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, u.id));
    expect(links).toHaveLength(1);
  });

  it("pré-inscription malveillante : mot de passe et sessions de l'attaquant révoqués", async () => {
    const p = profile("hijack");
    const [u] = await db
      .insert(users)
      .values({ email: p.email, name: "Attaquant", passwordHash: await hashPassword("connu-de-l-attaquant") })
      .returning();
    const attacker = await createSession(db, u.id, true);
    expect(await resolveSession(db, attacker.token)).not.toBeNull();

    await findOrCreateOAuthUser(db, "github", p);

    expect(await resolveSession(db, attacker.token)).toBeNull();
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    expect(after.passwordHash).toBeNull();
    expect(await db.select().from(sessions).where(eq(sessions.userId, u.id))).toHaveLength(0);
    void verifyPassword;
  });

  it("un compte déjà vérifié garde son mot de passe quand on lie un 2e fournisseur", async () => {
    const p = profile("verified");
    const [u] = await db
      .insert(users)
      .values({ email: p.email, name: "V", passwordHash: await hashPassword("secret-123"), emailVerified: true })
      .returning();
    const r = await findOrCreateOAuthUser(db, "google", p);
    expect(r.passwordRemoved).toBe(false);
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    expect(after.passwordHash).not.toBeNull();
  });

  it("enregistre la photo du fournisseur et la met à jour", async () => {
    const p = profile("photo", { image: "https://avatars.example/a.png" });
    const { userId } = await findOrCreateOAuthUser(db, "github", p);
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].image).toBe("https://avatars.example/a.png");
    await findOrCreateOAuthUser(db, "github", { ...p, image: "https://avatars.example/b.png" });
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].image).toBe("https://avatars.example/b.png");
    // pas d'écrasement par du vide
    await findOrCreateOAuthUser(db, "github", { ...p, image: null });
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].image).toBe("https://avatars.example/b.png");
  });
});

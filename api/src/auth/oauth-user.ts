import { and, eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { oauthAccounts, sessions, users } from "../db/schema.js";
import type { OAuthProfile, Provider } from "./oauth.js";

/**
 * Trouve ou crée l'utilisateur correspondant à un profil OAuth dont l'e-mail est vérifié.
 *
 * Si un compte existe déjà pour cet e-mail, on le relie : le fournisseur prouve que l'adresse est à
 * la personne qui se connecte. Mais si ce compte n'avait jamais prouvé son e-mail (inscription par
 * mot de passe), quelqu'un d'autre a pu le créer à l'avance : on supprime donc le mot de passe et on
 * ferme toutes les sessions. Le propriétaire réel garde l'accès via le fournisseur.
 */
export async function findOrCreateOAuthUser(db: Db, provider: Provider, profile: OAuthProfile) {
  const result = await resolveUser(db, provider, profile);
  // La photo suit celle du fournisseur ; on ne l'écrase pas par du vide.
  if (profile.image) await db.update(users).set({ image: profile.image }).where(eq(users.id, result.userId));
  return result;
}

async function resolveUser(db: Db, provider: Provider, profile: OAuthProfile) {
  const [linked] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, profile.providerAccountId)))
    .limit(1);
  if (linked) return { userId: linked.userId, passwordRemoved: false };

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, profile.email)).limit(1);
    let userId = existing?.id;
    let passwordRemoved = false;

    if (existing) {
      if (!existing.emailVerified) {
        passwordRemoved = existing.passwordHash !== null;
        await tx.update(users).set({ passwordHash: null, emailVerified: true }).where(eq(users.id, existing.id));
        await tx.delete(sessions).where(eq(sessions.userId, existing.id));
      }
    } else {
      [{ id: userId }] = await tx
        .insert(users)
        .values({ email: profile.email, name: profile.name, emailVerified: true })
        .returning({ id: users.id });
    }

    await tx.insert(oauthAccounts).values({ provider, providerAccountId: profile.providerAccountId, userId: userId! });
    return { userId: userId!, passwordRemoved };
  });
}

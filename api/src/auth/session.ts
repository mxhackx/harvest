import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";

export const SESSION_COOKIE = "harvest_session";
const DAY = 24 * 3600 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(db: Db, userId: string, remember: boolean) {
  const token = randomBytes(32).toString("base64url");
  const maxAgeMs = (remember ? 30 : 1) * DAY;
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + maxAgeMs),
  });
  return { token, maxAgeSec: Math.floor(maxAgeMs / 1000) };
}

export async function resolveSession(db: Db, token: string) {
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, image: users.image, emailReminders: users.emailReminders })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function destroySession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

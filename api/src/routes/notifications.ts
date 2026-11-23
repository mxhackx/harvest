import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";
import { requireMember } from "../plugins/auth.js";

const readBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(100).optional() });

/** Notifications personnelles : chacun ne voit et ne marque que les siennes, dans l'entreprise active. */
export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", { preHandler: requireMember }, async (req) => {
    const { subject } = req.member!;
    const mine = and(eq(notifications.userId, subject.userId), eq(notifications.companyId, subject.companyId));
    const items = await db.select().from(notifications).where(mine).orderBy(desc(notifications.createdAt)).limit(30);
    const [{ unread }] = await db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(mine, isNull(notifications.readAt)));
    return { items, unread };
  });

  // sans `ids` : tout marquer comme lu
  app.post("/notifications/read", { preHandler: requireMember }, async (req, reply) => {
    const body = readBody.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const conds = [
      eq(notifications.userId, subject.userId),
      eq(notifications.companyId, subject.companyId),
      isNull(notifications.readAt),
    ];
    if (body.data.ids) conds.push(inArray(notifications.id, body.data.ids));
    await db.update(notifications).set({ readAt: new Date() }).where(and(...conds));
    return reply.code(204).send();
  });
}

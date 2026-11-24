import type { FastifyInstance } from "fastify";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { auditLog, users } from "../db/schema.js";
import { requirePermission } from "../plugins/auth.js";

const query = z.object({ before: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) });

/** Journal d'audit de l'entreprise, du plus récent au plus ancien ; `before` = la date de la dernière ligne reçue. */
export async function auditRoutes(app: FastifyInstance) {
  app.get("/audit", { preHandler: requirePermission("audit:read") }, async (req, reply) => {
    const q = query.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query", issues: q.error.issues });
    const { subject } = req.member!;
    const rows = await db
      .select({ id: auditLog.id, action: auditLog.action, entityId: auditLog.entityId, entityLabel: auditLog.entityLabel, createdAt: auditLog.createdAt, actorName: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(and(eq(auditLog.companyId, subject.companyId), q.data.before ? lt(auditLog.createdAt, q.data.before) : undefined))
      .orderBy(desc(auditLog.createdAt))
      .limit(q.data.limit + 1);
    const items = rows.slice(0, q.data.limit);
    return { items, next: rows.length > q.data.limit ? items[items.length - 1].createdAt : null };
  });
}

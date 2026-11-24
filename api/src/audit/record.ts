import type { FastifyReply, FastifyRequest } from "fastify";
import { and, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLog } from "../db/schema.js";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);
/** Actions qui ne changent rien d'important ou qui seraient du bruit : jamais journalisées. */
const IGNORED = new Set(["POST /notifications/read", "PATCH /me/preferences", "POST /leads/locate", "POST /leads/locate-missing"]);
const UUID = /^[0-9a-f-]{36}$/i;

declare module "fastify" {
  interface FastifyRequest {
    /** Nom de l'objet touché, posé par la route pour que le journal le garde (ex. le lead supprimé). */
    auditLabel?: string;
  }
}

/** Faut-il journaliser cette requête ? Seulement une action réussie d'un membre qui modifie des données. */
export function shouldAudit(method: string, route: string | undefined, status: number, body: unknown): boolean {
  if (!route || !MUTATING.has(method) || status >= 400) return false;
  const action = `${method} ${route}`;
  if (IGNORED.has(action)) return false;
  // l'analyse à blanc d'un import n'écrit rien
  if (action === "POST /leads/import" && (body as { dryRun?: boolean } | null)?.dryRun !== false) return false;
  return true;
}

/** Hook onResponse : une ligne par action réussie. Un échec d'écriture du journal ne doit jamais gêner l'utilisateur. */
export async function auditHook(req: FastifyRequest, reply: FastifyReply) {
  if (!req.member || !req.user) return;
  const route = req.routeOptions.url;
  if (!shouldAudit(req.method, route, reply.statusCode, req.body)) return;
  const id = (req.params as { id?: string } | undefined)?.id;
  try {
    await db.insert(auditLog).values({
      companyId: req.member.subject.companyId,
      actorId: req.user.id,
      action: `${req.method} ${route}`,
      entityId: id && UUID.test(id) ? id : null,
      entityLabel: (req.auditLabel ?? "").slice(0, 200),
    });
  } catch (err) {
    req.log.error({ err }, "audit log failed");
  }
}

/** Le journal est conservé un an. */
export const AUDIT_DAYS = 365;
export async function purgeOldAudit(now = new Date()): Promise<number> {
  const gone = await db.delete(auditLog).where(and(lt(auditLog.createdAt, new Date(now.getTime() - AUDIT_DAYS * 86_400_000)))).returning({ id: auditLog.id });
  return gone.length;
}

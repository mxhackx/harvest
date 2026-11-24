import type { FastifyInstance } from "fastify";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { contacts, emailLog } from "../db/schema.js";
import { logActivities } from "../activities/log.js";
import { findReadableLead, leadAttrs } from "../leads/access.js";
import { sendMail } from "../mail/send.js";
import { can } from "../rbac/policy.js";
import { requirePermission } from "../plugins/auth.js";

const body = z.object({
  to: z.string().trim().toLowerCase().email().max(200),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  contactId: z.string().uuid().optional(),
});

/** Plafond par personne et par jour : un CRM qui écrit à des clients n'est pas un outil d'envoi en masse. */
export const DAILY_LIMIT = 100;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Texte brut → HTML simple : les retours à la ligne sont conservés, rien d'autre n'est interprété. */
export const textToHtml = (text: string) => `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;white-space:pre-wrap">${esc(text)}</div>`;

export async function emailRoutes(app: FastifyInstance) {
  // Écrire à un contact depuis la fiche d'un lead. Il faut pouvoir modifier le lead. Les réponses vont à l'expéditeur.
  app.post<{ Params: { id: string } }>("/leads/:id/emails", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    const { subject: actor } = { subject: req.member!.subject };
    const lead = await findReadableLead(actor, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (!can(actor, "lead:update", leadAttrs(lead))) return reply.code(403).send({ error: "forbidden" });
    if (parsed.data.contactId) {
      const [c] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.id, parsed.data.contactId), eq(contacts.leadId, lead.id)));
      if (!c) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "contact introuvable", path: ["contactId"] }] });
    }
    const [{ sent }] = await db
      .select({ sent: sql<number>`count(*)::int` })
      .from(emailLog)
      .where(and(eq(emailLog.sentBy, actor.userId), gte(emailLog.createdAt, new Date(Date.now() - 86_400_000))));
    if (sent >= DAILY_LIMIT) return reply.code(429).send({ error: "email_limit" });

    const ok = await sendMail(
      { to: parsed.data.to, subject: parsed.data.subject, text: parsed.data.body, html: textToHtml(parsed.data.body), replyTo: req.user!.email },
      req.log,
    );
    const [row] = await db
      .insert(emailLog)
      .values({ companyId: actor.companyId, leadId: lead.id, contactId: parsed.data.contactId ?? null, sentBy: actor.userId, toEmail: parsed.data.to, subject: parsed.data.subject, body: parsed.data.body, status: ok ? "sent" : "failed" })
      .returning();
    req.auditLabel = `${lead.name} → ${parsed.data.to}`;
    if (!ok) return reply.code(502).send({ error: "mail_failed" });
    // la trace visible dans le fil du lead
    await logActivities(
      [{ companyId: actor.companyId, leadId: lead.id, authorId: actor.userId, kind: "email", body: `E-mail à ${parsed.data.to} — ${parsed.data.subject}`.slice(0, 2000), meta: { emailLogId: row.id } }],
      (err) => req.log.error({ err }, "activity log failed"),
    );
    return reply.code(201).send({ id: row.id, status: row.status });
  });
}

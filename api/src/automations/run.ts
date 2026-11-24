import { and, eq, gte, inArray, isNull, lte, notExists, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { activities, automationRuns, automations, contacts, emailLog, leads, memberships, notifications, tasks, users } from "../db/schema.js";
import { sendMail } from "../mail/send.js";
import { alive } from "../leads/access.js";
import { listStages } from "../stages/store.js";

export const assignParams = z.object({ userIds: z.array(z.string().uuid()).min(1).max(30) });
export const taskParams = z.object({ title: z.string().trim().min(1).max(120), afterDays: z.number().int().min(1).max(60), priority: z.enum(["low", "normal", "high"]).default("normal") });
export const emailParams = z.object({ subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(5000), afterDays: z.number().int().min(1).max(60) });

/** Remplace {{contact}} et {{entreprise}} ; une variable inconnue reste visible. */
export const fill = (text: string, vars: Record<string, string>): string => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k] ?? m);

/** Personne suivante de la répartition à tour de rôle (le rang tourne sur la liste). */
export const pickNext = (userIds: string[], cursor: number): string => userIds[((cursor % userIds.length) + userIds.length) % userIds.length];

const DAY = 86_400_000;
/** On ne remonte pas au-delà de 30 jours après l'échéance : une règle créée aujourd'hui ne réveille pas de très vieux leads. */
const LOOKBACK_DAYS = 30;
const PER_RUN = 200;

/**
 * À la création d'un lead : la première règle d'attribution active de l'entreprise le confie à la personne suivante de sa
 * liste. Le lead lui appartient alors (et à son équipe) ; elle est notifiée. Renvoie le nouveau responsable, ou null.
 */
export async function assignOnCreate(companyId: string, lead: { id: string; name: string }): Promise<string | null> {
  const [rule] = await db.select().from(automations).where(and(eq(automations.companyId, companyId), eq(automations.kind, "assign"), eq(automations.active, true))).limit(1);
  const parsed = rule ? assignParams.safeParse(rule.params) : null;
  if (!rule || !parsed?.success) return null;
  // seules les personnes encore membres de l'entreprise reçoivent des leads
  const members = await db.select({ userId: memberships.userId, teamId: memberships.teamId }).from(memberships).where(and(eq(memberships.companyId, companyId), inArray(memberships.userId, parsed.data.userIds)));
  const ids = parsed.data.userIds.filter((u) => members.some((m) => m.userId === u));
  if (ids.length === 0) return null;
  // le curseur avance de façon atomique : deux leads créés en même temps n'ont pas la même personne
  const [{ cursor }] = await db.update(automations).set({ cursor: sql`${automations.cursor} + 1` }).where(eq(automations.id, rule.id)).returning({ cursor: automations.cursor });
  const owner = pickNext(ids, cursor - 1);
  const team = members.find((m) => m.userId === owner)?.teamId ?? null;
  await db.update(leads).set({ ownerId: owner, teamId: team, updatedAt: new Date() }).where(eq(leads.id, lead.id));
  await db.insert(automationRuns).values({ automationId: rule.id, leadId: lead.id, outcome: "done" }).onConflictDoNothing();
  await db.insert(notifications).values({ companyId, userId: owner, kind: "lead_assigned", title: `Attribution automatique : ${lead.name}`, leadId: lead.id });
  return owner;
}

/**
 * Règles qui agissent quelques jours après la création d'un lead encore ouvert : une tâche de relance, ou un e-mail de
 * suivi. Un lead sans suite (aucune visite, appel, message ni e-mail depuis sa création) est relancé ; sinon la règle
 * le note « ignoré » et n'y revient plus. Appelé toutes les 15 minutes par les tâches de fond.
 */
export async function runDelayedAutomations(now = new Date()): Promise<{ tasks: number; emails: number; skipped: number }> {
  const out = { tasks: 0, emails: 0, skipped: 0 };
  const rules = await db.select().from(automations).where(and(inArray(automations.kind, ["task", "email"]), eq(automations.active, true)));
  for (const rule of rules) {
    const parsed = rule.kind === "task" ? taskParams.safeParse(rule.params) : emailParams.safeParse(rule.params);
    if (!parsed.success) continue;
    const afterDays = (parsed.data as { afterDays: number }).afterDays;
    const stages = await listStages(rule.companyId);
    const open = stages.filter((s) => s.kind === "open").map((s) => s.key);
    if (open.length === 0) continue;
    const due = await db
      .select({ id: leads.id, name: leads.name, ownerId: leads.ownerId, teamId: leads.teamId, createdAt: leads.createdAt })
      .from(leads)
      .where(
        and(
          eq(leads.companyId, rule.companyId),
          alive,
          inArray(leads.status, open),
          lte(leads.createdAt, new Date(now.getTime() - afterDays * DAY)),
          gte(leads.createdAt, new Date(now.getTime() - (afterDays + LOOKBACK_DAYS) * DAY)),
          notExists(db.select({ x: sql`1` }).from(automationRuns).where(and(eq(automationRuns.automationId, rule.id), eq(automationRuns.leadId, leads.id)))),
        ),
      )
      .limit(PER_RUN);
    for (const lead of due) {
      const [contact] = await db.select({ name: contacts.name, email: contacts.email }).from(contacts).where(and(eq(contacts.leadId, lead.id), eq(contacts.isPrimary, true)));
      const [moved] = await db.select({ id: activities.id }).from(activities).where(and(eq(activities.leadId, lead.id), inArray(activities.kind, ["visit", "call", "message", "email"]), gte(activities.occurredAt, lead.createdAt))).limit(1);
      let outcome: "done" | "skipped" = "skipped";
      if (!moved) {
        if (rule.kind === "task") {
          const p = parsed.data as z.infer<typeof taskParams>;
          const [openTask] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.leadId, lead.id), isNull(tasks.doneAt))).limit(1);
          if (!openTask) {
            const [t] = await db.insert(tasks).values({ companyId: rule.companyId, teamId: lead.teamId, ownerId: lead.ownerId, createdBy: lead.ownerId, leadId: lead.id, title: fill(p.title, { entreprise: lead.name, contact: contact?.name ?? "" }), dueAt: now, priority: p.priority }).returning({ id: tasks.id });
            await db.insert(notifications).values({ companyId: rule.companyId, userId: lead.ownerId, kind: "task_assigned", title: `Relance automatique : ${lead.name}`, leadId: lead.id, taskId: t.id });
            outcome = "done";
            out.tasks++;
          }
        } else if (contact?.email) {
          const p = parsed.data as z.infer<typeof emailParams>;
          const vars = { contact: contact.name, entreprise: lead.name };
          const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, lead.ownerId));
          const text = fill(p.body, vars);
          const subject = fill(p.subject, vars);
          const ok = await sendMail({ to: contact.email.toLowerCase(), subject, text, html: `<div style="white-space:pre-wrap;font-family:system-ui,sans-serif;line-height:1.5">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</div>`, replyTo: owner?.email });
          await db.insert(emailLog).values({ companyId: rule.companyId, leadId: lead.id, sentBy: null, toEmail: contact.email.toLowerCase(), subject, body: text, status: ok ? "sent" : "failed" });
          if (ok) {
            await db.insert(activities).values({ companyId: rule.companyId, leadId: lead.id, authorId: lead.ownerId, kind: "email", body: `E-mail automatique à ${contact.email} — ${subject}`.slice(0, 2000) });
            outcome = "done";
            out.emails++;
          }
        }
      }
      if (outcome === "skipped") out.skipped++;
      await db.insert(automationRuns).values({ automationId: rule.id, leadId: lead.id, outcome }).onConflictDoNothing();
    }
  }
  return out;
}

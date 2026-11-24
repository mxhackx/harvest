import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { events, notifications, tasks, users } from "../db/schema.js";
import { sendMail } from "../mail/send.js";
import { reminderMail } from "../mail/templates.js";

/** Un rappel part cette durée avant l'échéance (ou le rendez-vous). */
export const LEAD_TIME_MS = 60 * 60_000;
/** Une échéance dépassée depuis plus longtemps n'est plus rappelée : on ne réveille pas de vieilles tâches. */
export const GRACE_MS = 24 * 3_600_000;

type Due = { userId: string; companyId: string; title: string; when: Date; kind: "task_due" | "event_soon"; leadId: string | null; taskId: string | null };

const clock = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });
const whenLabel = (d: Date, now: Date) => (d.getTime() < now.getTime() ? `en retard (${clock.format(d)})` : clock.format(d));

/** Lead hors corbeille (ou aucun lead) : les rappels d'un lead supprimé sont retenus. */
const leadAlive = (col: unknown) => sql`(${col} is null or not exists (select 1 from leads l where l.id = ${col} and l.deleted_at is not null))`;

/**
 * Envoie les rappels qui arrivent à échéance : une notification dans l'application et, si la personne l'accepte,
 * un seul e-mail regroupant ses rappels. Chaque tâche et chaque rendez-vous n'est rappelé qu'une fois : la ligne est
 * réservée (reminded_at) avant l'envoi, donc deux exécutions simultanées ne doublent rien.
 */
export async function sendDueReminders(now = new Date()): Promise<{ notified: number; emailed: number }> {
  const soon = new Date(now.getTime() + LEAD_TIME_MS);
  const since = new Date(now.getTime() - GRACE_MS);

  const dueTasks = await db
    .update(tasks)
    .set({ remindedAt: now })
    .where(and(isNull(tasks.doneAt), isNull(tasks.remindedAt), lte(tasks.dueAt, soon), gt(tasks.dueAt, since), leadAlive(tasks.leadId)))
    .returning({ id: tasks.id, userId: tasks.ownerId, companyId: tasks.companyId, title: tasks.title, when: tasks.dueAt, leadId: tasks.leadId });
  const dueEvents = await db
    .update(events)
    .set({ remindedAt: now })
    .where(and(eq(events.done, false), isNull(events.remindedAt), lte(events.startsAt, soon), gt(events.startsAt, new Date(now.getTime() - 15 * 60_000)), leadAlive(events.leadId)))
    .returning({ userId: events.ownerId, companyId: events.companyId, title: events.title, when: events.startsAt, leadId: events.leadId });

  const all: Due[] = [
    ...dueTasks.map((t) => ({ ...t, when: t.when!, kind: "task_due" as const, taskId: t.id })),
    ...dueEvents.map((e) => ({ ...e, kind: "event_soon" as const, taskId: null })),
  ];
  if (all.length === 0) return { notified: 0, emailed: 0 };

  await db.insert(notifications).values(
    all.map((d) => ({
      companyId: d.companyId,
      userId: d.userId,
      kind: d.kind,
      title: `${d.kind === "task_due" ? "Tâche" : "Rendez-vous"} : ${d.title} — ${whenLabel(d.when, now)}`,
      leadId: d.leadId,
      taskId: d.taskId,
    })),
  );

  let emailed = 0;
  const byUser = new Map<string, Due[]>();
  for (const d of all) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d]);
  for (const [userId, items] of byUser) {
    const [u] = await db.select({ email: users.email, emailReminders: users.emailReminders }).from(users).where(eq(users.id, userId));
    if (!u?.emailReminders) continue;
    const ok = await sendMail(reminderMail(u.email, { items: items.map((i) => ({ title: i.title, when: whenLabel(i.when, now) })), url: `${config.appUrls[0]}/dashboard/crm/tasks` }));
    if (ok) emailed++;
  }
  return { notified: all.length, emailed };
}

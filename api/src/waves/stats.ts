import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { activities, leads, waves } from "../db/schema.js";
import { alive } from "../leads/access.js";
import { listStages } from "../stages/store.js";

export type Wave = typeof waves.$inferSelect;
export type WavePhase = "planned" | "active" | "overdue" | "closed";
export type Bilan = NonNullable<Wave["bilan"]>;

/** Où en est une vague : clôturée, à venir, en cours, ou en retard (la période est passée sans clôture). `today` = AAAA-MM-JJ. */
export function wavePhase(w: Pick<Wave, "startsOn" | "endsOn" | "closedAt">, today: string): WavePhase {
  if (w.closedAt) return "closed";
  if (today < w.startsOn) return "planned";
  return today > w.endsOn ? "overdue" : "active";
}

/** Bornes de la période en UTC : du début du premier jour (inclus) à la fin du dernier (exclu). */
export function periodBounds(startsOn: string, endsOn: string): { from: Date; to: Date } {
  return { from: new Date(`${startsOn}T00:00:00Z`), to: new Date(new Date(`${endsOn}T00:00:00Z`).getTime() + 86_400_000) };
}

export const todayString = (now = new Date()) => now.toISOString().slice(0, 10);

export type LeadBrief = { id: string; name: string; city: string; phone: string };

/**
 * Bilan d'une vague d'après l'état actuel des leads de sa région. « Visité » = visite enregistrée pendant la période
 * (date de visite du lead, ou note de type visite dans son fil). « Converti » = passé en étape « gagné » pendant la période.
 * « À repasser » = lead encore ouvert (ni gagné ni perdu) et non visité pendant la période.
 * Seuls les prospects à visiter en présentiel comptent comme visités ou à repasser : un prospect simple (joint à distance)
 * n'a pas de visite à faire. Les convertis comptent tous les leads de la région.
 */
export async function computeBilan(w: Pick<Wave, "companyId" | "regionId" | "startsOn" | "endsOn" | "targetVisits">): Promise<{ bilan: Bilan; toRevisit: LeadBrief[] }> {
  const { from, to } = periodBounds(w.startsOn, w.endsOn);
  const rows = await db
    .select({ id: leads.id, name: leads.name, city: leads.city, phone: leads.phone, status: leads.status, visitedAt: leads.visitedAt, closedAt: leads.closedAt, visitMode: leads.visitMode })
    .from(leads)
    .where(and(eq(leads.companyId, w.companyId), eq(leads.regionId, w.regionId), alive));
  const kinds = new Map((await listStages(w.companyId)).map((s) => [s.key, s.kind]));
  const inPeriod = (d: Date | null) => !!d && d >= from && d < to;

  const visitNotes = rows.length
    ? await db
        .selectDistinct({ leadId: activities.leadId })
        .from(activities)
        .where(and(inArray(activities.leadId, rows.map((r) => r.id)), eq(activities.kind, "visit"), gte(activities.occurredAt, from), lt(activities.occurredAt, to)))
    : [];
  const noted = new Set(visitNotes.map((v) => v.leadId));

  const onsite = rows.filter((l) => l.visitMode === "onsite");
  const visitedIds = new Set(onsite.filter((l) => inPeriod(l.visitedAt) || noted.has(l.id)).map((l) => l.id));
  const converted = rows.filter((l) => kinds.get(l.status) === "won" && inPeriod(l.closedAt)).length;
  const toRevisit = onsite.filter((l) => (kinds.get(l.status) ?? "open") === "open" && !visitedIds.has(l.id));
  return {
    bilan: { total: onsite.length, visited: visitedIds.size, converted, toRevisit: toRevisit.length, targetVisits: w.targetVisits },
    toRevisit: toRevisit.slice(0, 200).map(({ id, name, city, phone }) => ({ id, name, city, phone })),
  };
}

import type { Lead } from "./api";
import type { Stage } from "./stages";

/** Probabilité retenue pour un lead : la sienne si elle est saisie, sinon celle de son étape. */
export function effectiveProbability(lead: Pick<Lead, "status" | "probability">, stages: Pick<Stage, "key" | "probability">[]): number {
  if (lead.probability !== null && lead.probability !== undefined) return lead.probability;
  return stages.find((s) => s.key === lead.status)?.probability ?? 0;
}

/** Valeur × probabilité, arrondie ; null si le lead n'a pas de valeur estimée. */
export function weightedValue(lead: Pick<Lead, "status" | "probability" | "estimatedValue">, stages: Pick<Stage, "key" | "probability">[]): number | null {
  if (lead.estimatedValue === null) return null;
  return Math.round((lead.estimatedValue * effectiveProbability(lead, stages)) / 100);
}

/** « 15 févr. 2027 » à partir de « 2027-02-15 » (date sans heure : pas de décalage de fuseau). */
export function formatCloseDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** La date de conclusion espérée est dépassée alors que le lead est encore ouvert. */
export function closeDateLate(day: string | null, open: boolean, now: Date = new Date()): boolean {
  if (!day || !open) return false;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59) < now;
}

export const PRIORITIES = [
  { value: "high", label: "Haute" },
  { value: "normal", label: "Normale" },
  { value: "low", label: "Basse" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["value"];

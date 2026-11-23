export type StageRow = { key: string; name: string; color: string; kind: "open" | "won" | "lost"; probability: number; count: number; value: number; weighted: number };
export type FunnelStage = { key: string; name: string; color: string; kind: "open" | "won" | "lost"; reached: number; ofCohort: number | null; fromPrevious: number | null };
export type Rep = {
  userId: string;
  name: string;
  leadsCreated: number;
  calls: number;
  messages: number;
  visits: number;
  emails: number;
  notes: number;
  stageChanges: number;
  won: number;
  wonValue: number;
  tasksDone: number;
};
export type Report = {
  period: { from: string; to: string };
  pipeline: { stages: StageRow[]; openCount: number; openValue: number; openWeighted: number };
  funnel: { cohort: number; stages: FunnelStage[]; won: number; lost: number; inProgress: number; winRate: number | null };
  closed: { won: number; wonValue: number; lost: number; lostReasons: { reason: string; count: number }[] };
  reps: Rep[];
};

/** « 75 % », ou « — » quand il n'y a rien à diviser (jamais « NaN % »). */
export const pct = (r: number | null): string => (r === null || !Number.isFinite(r) ? "—" : `${Math.round(r * 100)} %`);

export const PERIODS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 365, label: "12 mois" },
] as const;

/** Les `days` derniers jours jusqu'à maintenant, en ISO pour l'API. */
export function periodRange(days: number, now: Date = new Date()): { from: string; to: string } {
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to: now.toISOString() };
}

/** Largeur d'une barre en % du maximum ; une valeur non nulle reste visible (au moins 2 %). */
export function barWidth(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.max(2, Math.min(100, (value / max) * 100));
}

/** Total d'actions de terrain d'une personne : ce qui mesure son activité (hors changements d'étape et tâches). */
export const fieldActions = (r: Pick<Rep, "calls" | "messages" | "visits" | "emails" | "notes">) => r.calls + r.messages + r.visits + r.emails + r.notes;

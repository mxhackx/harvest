export type ForecastLead = { status: string; estimatedValue: number | null; probability: number | null; expectedCloseOn: string | null; createdAt: Date; closedAt: Date | null; ownerId: string };
export type StageLite = { key: string; kind: "open" | "won" | "lost"; probability: number };

/** Probabilité retenue : celle du lead si elle est saisie, sinon celle de son étape. */
export const probabilityOf = (l: Pick<ForecastLead, "status" | "probability">, stages: StageLite[]): number => l.probability ?? stages.find((s) => s.key === l.status)?.probability ?? 0;

export type ForecastMonth = { month: string | null; count: number; value: number; weighted: number };

/**
 * Prévision de chiffre d'affaires : les affaires en cours (étapes ouvertes, valeur connue) regroupées par mois de
 * conclusion espérée. `value` = tout ce qui est espéré, `weighted` = valeur × probabilité. Les affaires sans date
 * sont dans un groupe à part (`month: null`), toujours en dernier.
 */
export function forecastByMonth(leads: ForecastLead[], stages: StageLite[]): { months: ForecastMonth[]; value: number; weighted: number } {
  const kinds = new Map(stages.map((s) => [s.key, s.kind]));
  const groups = new Map<string | null, ForecastMonth>();
  for (const l of leads) {
    if ((kinds.get(l.status) ?? "open") !== "open" || !l.estimatedValue) continue;
    const month = l.expectedCloseOn ? l.expectedCloseOn.slice(0, 7) : null;
    const g = groups.get(month) ?? { month, count: 0, value: 0, weighted: 0 };
    g.count++;
    g.value += l.estimatedValue;
    g.weighted += Math.round((l.estimatedValue * probabilityOf(l, stages)) / 100);
    groups.set(month, g);
  }
  const months = [...groups.values()].sort((a, b) => (a.month === null ? 1 : b.month === null ? -1 : a.month.localeCompare(b.month)));
  return { months, value: months.reduce((s, m) => s + m.value, 0), weighted: months.reduce((s, m) => s + m.weighted, 0) };
}

export type Kpis = { won: number; lost: number; conversionRate: number | null; avgCycleDays: number | null; wonValue: number; avgDeal: number | null };

/**
 * Indicateurs de performance sur une période : affaires gagnées et perdues (clôturées dans la période), taux de
 * conversion (gagnées sur gagnées + perdues), durée moyenne d'une vente (de la création du lead à sa conclusion, en
 * jours), chiffre d'affaires gagné et panier moyen. Rien n'est inventé : sans donnée, la valeur est null.
 */
export function kpis(leads: ForecastLead[], stages: StageLite[], from: Date, to: Date): Kpis {
  const kinds = new Map(stages.map((s) => [s.key, s.kind]));
  const closed = leads.filter((l) => l.closedAt && l.closedAt >= from && l.closedAt < to);
  const won = closed.filter((l) => kinds.get(l.status) === "won");
  const lost = closed.filter((l) => kinds.get(l.status) === "lost");
  const days = won.map((l) => (l.closedAt!.getTime() - l.createdAt.getTime()) / 86_400_000);
  const wonValue = won.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
  return {
    won: won.length,
    lost: lost.length,
    conversionRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
    avgCycleDays: days.length ? Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10 : null,
    wonValue,
    avgDeal: won.length ? Math.round(wonValue / won.length) : null,
  };
}

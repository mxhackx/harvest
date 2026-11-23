export type StageRef = { key: string; name: string; color: string; kind: "open" | "won" | "lost"; probability: number };
export type LeadRow = { id: string; status: string; estimatedValue: number | null };
export type Move = { leadId: string; from: string | null; to: string | null };

const round = (n: number) => Math.round(n);

/** Photo du pipeline : par étape, nombre de leads, valeur, valeur pondérée (valeur × probabilité, étapes ouvertes seulement). */
export function pipelineByStage(stages: StageRef[], leads: LeadRow[]) {
  const rows = stages.map((s) => ({ key: s.key, name: s.name, color: s.color, kind: s.kind, probability: s.probability, count: 0, value: 0, weighted: 0 }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const l of leads) {
    const r = byKey.get(l.status);
    if (!r) continue; // étape supprimée entre-temps : ignorée plutôt que fausser un total
    const v = l.estimatedValue ?? 0;
    r.count++;
    r.value += v;
    if (r.kind === "open") r.weighted += (v * r.probability) / 100;
  }
  for (const r of rows) r.weighted = round(r.weighted);
  const open = rows.filter((r) => r.kind === "open");
  return {
    stages: rows,
    openCount: open.reduce((n, r) => n + r.count, 0),
    openValue: open.reduce((n, r) => n + r.value, 0),
    openWeighted: open.reduce((n, r) => n + r.weighted, 0),
  };
}

/**
 * Entonnoir d'une cohorte de leads : combien ont atteint chaque étape (ouverte ou gagnée), et le taux depuis l'étape
 * précédente. Un lead a « atteint » une étape s'il y est, ou s'il y est passé (déplacement depuis ou vers elle).
 * Un lead gagné a forcément dépassé les étapes ouvertes qu'il n'a pas traversées dans l'historique : il compte à chacune
 * (sinon passer directement à « Gagné » ferait baisser les taux).
 */
export function funnel(stages: StageRef[], cohort: LeadRow[], moves: Move[]) {
  const progression = stages.filter((s) => s.kind !== "lost");
  const wonKeys = new Set(stages.filter((s) => s.kind === "won").map((s) => s.key));
  const visited = new Map<string, Set<string>>();
  for (const l of cohort) visited.set(l.id, new Set([l.status]));
  for (const m of moves) {
    const set = visited.get(m.leadId);
    if (!set) continue;
    if (m.from) set.add(m.from);
    if (m.to) set.add(m.to);
  }
  const lastOpenIndex = Math.max(...progression.map((s, i) => (s.kind === "open" ? i : -1)), -1);
  const reached = progression.map((s, i) => {
    let n = 0;
    for (const l of cohort) {
      const set = visited.get(l.id)!;
      const isWon = wonKeys.has(l.status);
      if (set.has(s.key) || (isWon && s.kind === "open" && i <= lastOpenIndex)) n++;
    }
    return n;
  });
  const total = cohort.length;
  const lost = cohort.filter((l) => stages.find((s) => s.key === l.status)?.kind === "lost").length;
  const won = cohort.filter((l) => wonKeys.has(l.status)).length;
  return {
    cohort: total,
    stages: progression.map((s, i) => ({
      key: s.key,
      name: s.name,
      color: s.color,
      kind: s.kind,
      reached: reached[i],
      // part de la cohorte, et taux depuis l'étape précédente ; null quand il n'y a rien à diviser
      ofCohort: total ? reached[i] / total : null,
      fromPrevious: i === 0 ? null : reached[i - 1] ? reached[i] / reached[i - 1] : null,
    })),
    won,
    lost,
    inProgress: total - won - lost,
    // taux de réussite sur les dossiers tranchés (gagnés + perdus) : ne punit pas les leads encore en cours
    winRate: won + lost ? won / (won + lost) : null,
  };
}

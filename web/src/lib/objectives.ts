export type ObjectiveRow = {
  userId: string;
  name: string;
  target: { visits: number; won: number; value: number };
  done: { visits: number; won: number; value: number };
  percent: { visits: number | null; won: number | null; value: number | null };
};

/** Mois précédent ou suivant d'un « AAAA-MM ». */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const monthLabel = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** Largeur de barre (0–100) pour un pourcentage qui peut dépasser 100 ; 0 sans objectif. */
export const barWidth = (percent: number | null) => (percent === null ? 0 : Math.max(0, Math.min(100, percent)));

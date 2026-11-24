/** « 2026-11 » ou « 2026-11-24 » → premier jour du mois (AAAA-MM-01) ; null si illisible. */
export function monthStart(input: string): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/.exec(input.trim());
  return m ? `${m[1]}-${m[2]}-01` : null;
}

/** Bornes UTC d'un mois : début inclus, début du mois suivant exclu. */
export function monthBounds(month: string): { from: Date; to: Date } {
  const from = new Date(`${month}T00:00:00Z`);
  return { from, to: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1)) };
}

/** Avancement en pourcentage (peut dépasser 100) ; null sans objectif. */
export const percent = (done: number, target: number): number | null => (target > 0 ? Math.round((done / target) * 100) : null);

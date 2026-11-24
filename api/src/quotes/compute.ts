export type Line = { label: string; quantity: number; unitPrice: number };
export type Totals = { subtotal: number; tax: number; total: number };
export type Status = "draft" | "sent" | "accepted" | "declined";

/** Total d'une ligne : quantité (jusqu'à 2 décimales) × prix unitaire, arrondi à l'unité. */
export const lineTotal = (l: Line): number => Math.round(l.quantity * l.unitPrice);

/** Sous-total, taxe (taux en %, arrondie à l'unité) et total d'un devis. */
export function computeTotals(lines: Line[], taxRate: number): Totals {
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const tax = Math.round((subtotal * taxRate) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

/** Numéro suivant d'une année : D-2026-0001, D-2026-0002… ; l'année est celle de la date donnée, les numéros d'autres années sont ignorés. */
export function nextNumber(existing: string[], now = new Date()): string {
  const year = now.getUTCFullYear();
  const prefix = `D-${year}-`;
  const max = existing.filter((n) => n.startsWith(prefix)).reduce((m, n) => Math.max(m, Number(n.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

const NEXT: Record<Status, Status[]> = { draft: ["sent"], sent: ["accepted", "declined"], accepted: [], declined: [] };
/** Un devis avance dans un seul sens : brouillon → envoyé → accepté ou refusé. Rien ne se rouvre. */
export const canTransition = (from: Status, to: Status): boolean => NEXT[from].includes(to);

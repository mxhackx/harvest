export type Line = { label: string; quantity: number; unitPrice: number };
export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";
export type Quote = {
  id: string;
  leadId: string;
  number: string;
  title: string;
  status: QuoteStatus;
  lines: Line[];
  taxRate: number;
  validUntil: string | null;
  notes: string;
  subtotal: number;
  tax: number;
  total: number;
  sentAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  leadName?: string;
};

export const STATUS_LABEL: Record<QuoteStatus, string> = { draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", declined: "Refusé" };
/** Jeton de couleur pour la pastille d'un statut. */
export const STATUS_TOKEN: Record<QuoteStatus, string> = { draft: "--color-neutral", sent: "--color-wave-active", accepted: "--color-wave-closed", declined: "--color-wave-overdue" };

export const lineTotal = (l: Line): number => Math.round(l.quantity * l.unitPrice);
export const totals = (lines: Line[], taxRate: number) => {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const tax = Math.round((subtotal * taxRate) / 100);
  return { subtotal, tax, total: subtotal + tax };
};

export const fmt = (n: number): string => n.toLocaleString("fr-FR");

/** Nombre saisi (virgule ou point, espaces) → nombre, ou null s'il est illisible ou négatif. */
export function parseNumber(raw: string): number | null {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Lignes du formulaire → lignes à envoyer, ou le premier problème en français. Les lignes entièrement vides sont ignorées. */
export function cleanLines(rows: { label: string; quantity: string; unitPrice: string }[]): { ok: true; lines: Line[] } | { ok: false; message: string } {
  const lines: Line[] = [];
  for (const [i, r] of rows.entries()) {
    if (!r.label.trim() && !r.quantity.trim() && !r.unitPrice.trim()) continue;
    const quantity = parseNumber(r.quantity);
    const unitPrice = parseNumber(r.unitPrice);
    if (!r.label.trim()) return { ok: false, message: `Ligne ${i + 1} : donnez un libellé.` };
    if (quantity === null || quantity <= 0 || Math.abs(quantity * 100 - Math.round(quantity * 100)) > 1e-6) return { ok: false, message: `Ligne ${i + 1} : quantité invalide (supérieure à 0, 2 décimales au plus).` };
    if (unitPrice === null || !Number.isInteger(unitPrice)) return { ok: false, message: `Ligne ${i + 1} : prix unitaire invalide (nombre entier).` };
    lines.push({ label: r.label.trim(), quantity, unitPrice });
  }
  return { ok: true, lines };
}

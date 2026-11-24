import { parseCsv } from "../leads/csv.js";
import { neutralizeFormula } from "../leads/export.js";
import { computeTotals, type Line } from "./compute.js";

export const MAX_QUOTES_PER_FILE = 50;
export const MAX_LINES = 50;

export type QuoteInput = { title: string; taxRate: number; validUntil: string | null; notes: string; lines: Line[] };
export type ParseError = { row: number; message: string };
export type Parsed = { quotes: QuoteInput[]; errors: ParseError[] };

export type ExportQuote = { number: string; lead: string; title: string; status: string; validUntil: string | null; taxRate: number; notes: string; lines: Line[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return String(v ?? "").trim() !== "" && Number.isFinite(n) ? n : null;
};

/** Vérifie un devis lu dans un fichier (JSON ou CSV) : le premier problème est renvoyé en français, sinon le devis nettoyé. */
export function cleanQuote(raw: Record<string, unknown>, row: number): { quote?: QuoteInput; error?: ParseError } {
  const fail = (message: string) => ({ error: { row, message } });
  const title = String(raw.title ?? "").trim();
  if (!title) return fail("titre manquant");
  if (title.length > 150) return fail("titre trop long (150 caractères au plus)");
  const taxRate = raw.taxRate === undefined || raw.taxRate === "" ? 0 : num(raw.taxRate);
  if (taxRate === null || !Number.isInteger(taxRate) || taxRate < 0 || taxRate > 100) return fail("taxe invalide (entier de 0 à 100)");
  const validUntil = raw.validUntil === undefined || raw.validUntil === null || raw.validUntil === "" ? null : String(raw.validUntil).trim();
  if (validUntil !== null && (!DATE.test(validUntil) || Number.isNaN(Date.parse(`${validUntil}T00:00:00Z`)))) return fail("date de validité invalide (AAAA-MM-JJ)");
  const notes = String(raw.notes ?? "").trim();
  if (notes.length > 2000) return fail("notes trop longues (2000 caractères au plus)");
  const rawLines = Array.isArray(raw.lines) ? (raw.lines as Record<string, unknown>[]) : [];
  if (rawLines.length > MAX_LINES) return fail(`trop de lignes (${MAX_LINES} au plus)`);
  const lines: Line[] = [];
  for (const [i, l] of rawLines.entries()) {
    const label = String(l.label ?? "").trim();
    const quantity = num(l.quantity);
    const unitPrice = num(l.unitPrice);
    if (!label) return fail(`ligne ${i + 1} : libellé manquant`);
    if (quantity === null || quantity <= 0 || Math.abs(quantity * 100 - Math.round(quantity * 100)) > 1e-6) return fail(`ligne ${i + 1} : quantité invalide (supérieure à 0, 2 décimales au plus)`);
    if (unitPrice === null || !Number.isInteger(unitPrice) || unitPrice < 0) return fail(`ligne ${i + 1} : prix unitaire invalide (entier, 0 ou plus)`);
    lines.push({ label: label.slice(0, 200), quantity, unitPrice });
  }
  return { quote: { title, taxRate, validUntil, notes, lines } };
}

/** JSON : un tableau de devis, ou un seul devis. Chaque devis : title, taxRate, validUntil, notes, lines[{label, quantity, unitPrice}]. */
export function parseQuotesJson(content: string): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(content.replace(/^﻿/, ""));
  } catch {
    return { quotes: [], errors: [{ row: 0, message: "JSON illisible" }] };
  }
  const list = Array.isArray(data) ? data : data && typeof data === "object" && Array.isArray((data as { quotes?: unknown }).quotes) ? (data as { quotes: unknown[] }).quotes : [data];
  if (list.length > MAX_QUOTES_PER_FILE) return { quotes: [], errors: [{ row: 0, message: `trop de devis dans le fichier (${MAX_QUOTES_PER_FILE} au plus)` }] };
  const out: Parsed = { quotes: [], errors: [] };
  list.forEach((item, i) => {
    if (!item || typeof item !== "object") return void out.errors.push({ row: i + 1, message: "ce n'est pas un devis" });
    const r = cleanQuote(item as Record<string, unknown>, i + 1);
    if (r.quote) out.quotes.push(r.quote);
    else out.errors.push(r.error!);
  });
  return out;
}

/**
 * CSV : une ligne par ligne de devis. Colonnes : title (ou reference), taxRate, validUntil, notes, label, quantity, unitPrice.
 * Les lignes qui ont le même titre font un seul devis ; les infos du devis (taxe, validité, notes) se lisent sur sa première ligne.
 */
export function parseQuotesCsv(content: string): Parsed {
  const records = parseCsv(content.replace(/^﻿/, ""));
  if (records.length < 2) return { quotes: [], errors: [{ row: 0, message: "fichier vide : il faut une ligne d'en-tête puis des lignes" }] };
  const header = records[0].fields.map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = { title: col("title", "titre", "reference", "référence"), tax: col("taxrate", "taxe", "tva"), valid: col("validuntil", "validite", "validité"), notes: col("notes"), label: col("label", "libelle", "libellé", "designation", "désignation"), qty: col("quantity", "quantite", "quantité"), price: col("unitprice", "prix", "prixunitaire") };
  if (idx.title < 0 || idx.label < 0 || idx.qty < 0 || idx.price < 0) return { quotes: [], errors: [{ row: 0, message: "colonnes attendues : title, label, quantity, unitPrice (et facultatives : taxRate, validUntil, notes)" }] };
  const groups = new Map<string, { first: number; raw: Record<string, unknown>; lines: Record<string, unknown>[] }>();
  for (const rec of records.slice(1)) {
    const f = rec.fields;
    const title = (f[idx.title] ?? "").trim();
    const line = { label: f[idx.label], quantity: f[idx.qty], unitPrice: f[idx.price] };
    const g = groups.get(title);
    if (g) g.lines.push(line);
    else groups.set(title, { first: rec.line, raw: { title, taxRate: idx.tax >= 0 ? f[idx.tax] : "", validUntil: idx.valid >= 0 ? f[idx.valid] : "", notes: idx.notes >= 0 ? f[idx.notes] : "" }, lines: [line] });
  }
  if (groups.size > MAX_QUOTES_PER_FILE) return { quotes: [], errors: [{ row: 0, message: `trop de devis dans le fichier (${MAX_QUOTES_PER_FILE} au plus)` }] };
  const out: Parsed = { quotes: [], errors: [] };
  for (const g of groups.values()) {
    const r = cleanQuote({ ...g.raw, lines: g.lines }, g.first);
    if (r.quote) out.quotes.push(r.quote);
    else out.errors.push(r.error!);
  }
  return out;
}

const COLUMNS = ["number", "lead", "title", "status", "validUntil", "taxRate", "notes", "label", "quantity", "unitPrice", "lineTotal", "subtotal", "tax", "total"] as const;
const cell = (v: string | number | null, delimiter: string): string => {
  if (v === null) return "";
  const s = neutralizeFormula(String(v));
  return s.includes(delimiter) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV des devis : une ligne par ligne de devis (un devis sans ligne donne une ligne vide), totaux répétés ; BOM pour Excel. */
export function quotesToCsv(quotes: ExportQuote[], delimiter: "," | ";" = ","): string {
  const rows: (string | number | null)[][] = [];
  for (const q of quotes) {
    const t = computeTotals(q.lines, q.taxRate);
    const head = [q.number, q.lead, q.title, q.status, q.validUntil, q.taxRate, q.notes];
    const tail = [t.subtotal, t.tax, t.total];
    if (q.lines.length === 0) rows.push([...head, "", "", "", "", ...tail]);
    for (const l of q.lines) rows.push([...head, l.label, l.quantity, l.unitPrice, Math.round(l.quantity * l.unitPrice), ...tail]);
  }
  return "﻿" + [COLUMNS.join(delimiter), ...rows.map((r) => r.map((v) => cell(v, delimiter)).join(delimiter))].join("\r\n") + "\r\n";
}

/** JSON des devis : le même format que l'import (on peut réimporter un export), plus numéro, lead, statut et totaux. */
export function quotesToJson(quotes: ExportQuote[]): string {
  return JSON.stringify(quotes.map((q) => ({ ...q, ...computeTotals(q.lines, q.taxRate) })), null, 2);
}

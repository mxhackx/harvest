import { and, eq, ilike, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { leads } from "../db/schema.js";
import { alive } from "./access.js";

export const MAX_NAME = 120;
const SUFFIX = /\s*\((\d+)\)\s*$/;

/** « Pharmacie (2) » → « Pharmacie » ; un nom qui ne serait que « (2) » est gardé tel quel. */
export const baseName = (name: string) => name.replace(SUFFIX, "").trim() || name.trim();

/**
 * Premier nom libre : le nom demandé s'il est libre, sinon « Nom (1) », « Nom (2) »… La comparaison ignore
 * la casse. Un nom déjà numéroté repart de sa base (« Salon (1) » pris → « Salon (2) », pas « Salon (1) (1) »).
 */
export function pickUniqueName(requested: string, taken: Iterable<string>): string {
  const set = new Set([...taken].map((n) => n.trim().toLowerCase()));
  const wanted = requested.trim();
  if (!set.has(wanted.toLowerCase())) return wanted;
  const base = baseName(wanted);
  for (let n = 1; ; n++) {
    const suffix = ` (${n})`;
    // le nom complet ne doit jamais dépasser la limite de 120 caractères
    const candidate = base.slice(0, MAX_NAME - suffix.length).trimEnd() + suffix;
    if (!set.has(candidate.toLowerCase())) return candidate;
  }
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/** Noms des leads de l'entreprise susceptibles d'entrer en conflit avec `requested` (même base). */
export async function takenNames(companyId: string, requested: string, excludeId?: string): Promise<string[]> {
  const rows = await db
    .select({ name: leads.name })
    .from(leads)
    .where(and(eq(leads.companyId, companyId), alive, ilike(leads.name, `${escapeLike(baseName(requested))}%`), excludeId ? ne(leads.id, excludeId) : undefined));
  return rows.map((r) => r.name);
}

/** Tous les noms de l'entreprise : utile à un import qui en numérote beaucoup d'un coup. */
export async function allNames(companyId: string): Promise<string[]> {
  return (await db.select({ name: leads.name }).from(leads).where(and(eq(leads.companyId, companyId), alive))).map((r) => r.name);
}

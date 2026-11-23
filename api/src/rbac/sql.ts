import { and, eq, or, type AnyColumn, type SQL } from "drizzle-orm";
import { listFilter, type Subject } from "./policy.js";

/** Les colonnes dont dépend la portée : toute table « possédée » (leads, events…) les a. */
export type ScopedColumns = { companyId: AnyColumn; ownerId: AnyColumn; teamId: AnyColumn };

/**
 * Restriction SQL selon la portée du droit (own / team / company), toujours bornée à l'entreprise.
 * `null` si le sujet n'a pas le droit du tout.
 */
export function scopeCondition(cols: ScopedColumns, subject: Subject, permission: string): SQL | null {
  const f = listFilter(subject, permission);
  const company = eq(cols.companyId, subject.companyId);
  if (f.kind === "none") return null;
  if (f.kind === "company") return company;
  if (f.kind === "own") return and(company, eq(cols.ownerId, f.userId))!;
  return and(company, f.teamId ? or(eq(cols.ownerId, f.userId), eq(cols.teamId, f.teamId)) : eq(cols.ownerId, f.userId))!;
}

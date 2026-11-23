/** Violation d'unicité Postgres (23505), que l'erreur soit brute ou enveloppée par Drizzle (code dans `cause`). */
export function isUniqueViolation(e: unknown): boolean {
  for (let cur: unknown = e, depth = 0; cur && typeof cur === "object" && depth < 4; cur = (cur as { cause?: unknown }).cause, depth++) {
    if ((cur as { code?: string }).code === "23505") return true;
  }
  return false;
}

import { db } from "../db/index.js";
import { activities } from "../db/schema.js";

export type ActivityKind = typeof activities.$inferInsert.kind;
export type ActivityInput = {
  companyId: string;
  leadId: string;
  authorId: string;
  kind: ActivityKind;
  body?: string;
  meta?: Record<string, unknown>;
  occurredAt?: Date;
};

/** Saisies à la main : seules celles-ci peuvent être créées, modifiées ou supprimées par un utilisateur. */
export const MANUAL_KINDS = ["note", "call", "message", "visit", "email"] as const;
export const isManualKind = (k: string): k is (typeof MANUAL_KINDS)[number] => (MANUAL_KINDS as readonly string[]).includes(k);

/**
 * Enregistre des événements système dans le fil. Un échec n'annule pas l'action de l'utilisateur (le lead est
 * déjà modifié) : il est signalé par `onError` et le fil le montrera comme une absence, jamais comme une erreur.
 */
export async function logActivities(rows: ActivityInput[], onError?: (e: unknown) => void): Promise<void> {
  if (!rows.length) return;
  try {
    for (let i = 0; i < rows.length; i += 500) await db.insert(activities).values(rows.slice(i, i + 500));
  } catch (e) {
    onError?.(e);
  }
}

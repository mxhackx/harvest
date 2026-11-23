import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { leads, pipelineStages } from "../db/schema.js";

export type Stage = typeof pipelineStages.$inferSelect;

export const listStages = (companyId: string): Promise<Stage[]> =>
  db.select().from(pipelineStages).where(eq(pipelineStages.companyId, companyId)).orderBy(asc(pipelineStages.position));

/** Étape donnée à un lead créé sans étape : la première étape ouverte. */
export const defaultStage = (stages: Stage[]) => stages.find((s) => s.kind === "open") ?? stages[0];

/** « Maquette envoyée » → « maquette_envoyee » : clé stable, sans accents, unique dans l'entreprise. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "etape";
}

export function uniqueKey(name: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  const base = slugify(name);
  if (!set.has(base)) return base;
  for (let n = 2; ; n++) if (!set.has(`${base}_${n}`)) return `${base}_${n}`;
}

const KIND_ORDER = { open: 0, won: 1, lost: 2 } as const;

/** Réécrit les positions 0…n : les étapes ouvertes d'abord, puis « gagné », puis « perdu », ordre relatif conservé. */
export async function normalizePositions(companyId: string) {
  const stages = await listStages(companyId);
  const ordered = [...stages].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.position - b.position);
  await Promise.all(
    ordered.map((s, i) => (s.position === i ? null : db.update(pipelineStages).set({ position: i }).where(eq(pipelineStages.id, s.id)))),
  );
}

/** Champs d'un lead qui découlent de son étape : date de clôture et motif de perte. */
export function closingFields(stage: Pick<Stage, "kind">, current: { closedAt: Date | null; lostReason: string }, lostReason?: string) {
  if (stage.kind === "open") return { closedAt: null, lostReason: "" };
  return {
    closedAt: current.closedAt ?? new Date(),
    lostReason: stage.kind === "lost" ? (lostReason ?? current.lostReason) : "",
  };
}

export const countLeadsIn = async (companyId: string, key: string) => {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.companyId, companyId), eq(leads.status, key)));
  return n;
};

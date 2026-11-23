import type { Lead } from "./api";

export type StageKind = "open" | "won" | "lost";

export type Stage = {
  id: string;
  key: string;
  name: string;
  /** Couleur CSS (#rrggbb ou rgba()) : colore aussi le point du lead sur la carte. */
  color: string;
  /** Chance de conclure à cette étape, en % : sert à pondérer la valeur du pipeline. */
  probability: number;
  kind: StageKind;
  position: number;
};

/** Étapes d'une nouvelle entreprise : affichage de secours tant que les vraies ne sont pas chargées. */
export const DEFAULT_STAGES: Stage[] = [
  { id: "d-0", key: "to_visit", name: "À visiter", color: "#e5484d", probability: 10, kind: "open", position: 0 },
  { id: "d-1", key: "interested", name: "Intéressé", color: "#0868c9", probability: 30, kind: "open", position: 1 },
  { id: "d-2", key: "mockup_sent", name: "Maquette envoyée", color: "rgba(34, 170, 94, 0.6)", probability: 60, kind: "open", position: 2 },
  { id: "d-3", key: "deposit_paid", name: "Acompte payé", color: "#12c457", probability: 90, kind: "open", position: 3 },
  { id: "d-4", key: "won", name: "Gagné", color: "#07625a", probability: 100, kind: "won", position: 4 },
  { id: "d-5", key: "lost", name: "Perdu", color: "#8a99a6", probability: 0, kind: "lost", position: 5 },
];

/** Étape d'une clé donnée ; une clé inconnue (étape supprimée entre-temps) s'affiche en gris, sans casser l'écran. */
export function stageOf(stages: Stage[], key: string): Stage {
  return stages.find((s) => s.key === key) ?? { id: `unknown-${key}`, key, name: key, color: "#8a99a6", probability: 0, kind: "open", position: 999 };
}

/** Motifs de perte proposés ; la saisie reste libre. */
export const LOST_REASONS = ["Pas intéressé", "Trop cher", "Choisi un concurrent", "Injoignable", "Entreprise fermée", "Autre"];

export type PipelineSummary = {
  /** Leads dans une étape ouverte : nombre, valeur, et valeur pondérée par la probabilité de chaque étape. */
  open: { count: number; value: number; weighted: number };
  won: { count: number; value: number };
  lost: { count: number; value: number };
};

export function pipelineSummary(leads: Pick<Lead, "status" | "estimatedValue">[], stages: Stage[]): PipelineSummary {
  const out: PipelineSummary = { open: { count: 0, value: 0, weighted: 0 }, won: { count: 0, value: 0 }, lost: { count: 0, value: 0 } };
  for (const l of leads) {
    const stage = stageOf(stages, l.status);
    const value = l.estimatedValue ?? 0;
    const bucket = out[stage.kind];
    bucket.count++;
    bucket.value += value;
    if (stage.kind === "open") out.open.weighted += (value * stage.probability) / 100;
  }
  out.open.weighted = Math.round(out.open.weighted);
  return out;
}

/** Palette proposée pour colorer une étape : assez contrastée pour rester lisible sur la carte. */
export const STAGE_COLORS = ["#e5484d", "#f76b15", "#e0a100", "#12c457", "#07625a", "#0868c9", "#8e4ec6", "#8a99a6"];

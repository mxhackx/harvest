export type StageKind = "open" | "won" | "lost";
export type StageSeed = { key: string; name: string; color: string; probability: number; kind: StageKind };

/** Étapes créées avec chaque entreprise. Les quatre premières sont celles du cahier, avec leurs couleurs de carte. */
export const DEFAULT_STAGES: StageSeed[] = [
  { key: "to_visit", name: "À visiter", color: "#e5484d", probability: 10, kind: "open" },
  { key: "interested", name: "Intéressé", color: "#0868c9", probability: 30, kind: "open" },
  { key: "mockup_sent", name: "Maquette envoyée", color: "rgba(34, 170, 94, 0.6)", probability: 60, kind: "open" },
  { key: "deposit_paid", name: "Acompte payé", color: "#12c457", probability: 90, kind: "open" },
  { key: "won", name: "Gagné", color: "#07625a", probability: 100, kind: "won" },
  { key: "lost", name: "Perdu", color: "#8a99a6", probability: 0, kind: "lost" },
];

/** Motifs de perte proposés : la liste est libre, ils servent de raccourcis. */
export const LOST_REASONS = ["Pas intéressé", "Trop cher", "Choisi un concurrent", "Injoignable", "Entreprise fermée", "Autre"];

export const COLOR_RE = /^(#[0-9a-fA-F]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/;

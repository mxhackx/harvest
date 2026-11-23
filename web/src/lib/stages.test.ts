import { describe, expect, it } from "vitest";
import { DEFAULT_STAGES, STAGE_COLORS, pipelineSummary, stageOf } from "./stages";

const lead = (status: string, value: number | null) => ({ status, estimatedValue: value });

describe("stageOf", () => {
  it("retrouve une étape par sa clé", () => {
    expect(stageOf(DEFAULT_STAGES, "interested")).toMatchObject({ name: "Intéressé", color: "#0868c9" });
  });
  it("une clé inconnue (étape supprimée) s'affiche en gris au lieu de casser l'écran", () => {
    expect(stageOf(DEFAULT_STAGES, "disparue")).toMatchObject({ key: "disparue", name: "disparue", color: "#8a99a6", kind: "open" });
  });
});

describe("pipelineSummary", () => {
  it("compte et additionne par type d'étape", () => {
    const s = pipelineSummary([lead("to_visit", 1000), lead("interested", 2000), lead("won", 5000), lead("lost", 700), lead("lost", null)], DEFAULT_STAGES);
    expect(s.open).toMatchObject({ count: 2, value: 3000 });
    expect(s.won).toEqual({ count: 1, value: 5000 });
    expect(s.lost).toEqual({ count: 2, value: 700 });
  });
  it("pondère les leads ouverts par la probabilité de leur étape", () => {
    // 1000 × 10 % + 2000 × 30 % + 4000 × 90 % = 100 + 600 + 3600
    const s = pipelineSummary([lead("to_visit", 1000), lead("interested", 2000), lead("deposit_paid", 4000)], DEFAULT_STAGES);
    expect(s.open.weighted).toBe(4300);
  });
  it("les leads gagnés et perdus ne comptent pas dans la valeur pondérée", () => {
    expect(pipelineSummary([lead("won", 9999), lead("lost", 9999)], DEFAULT_STAGES).open).toEqual({ count: 0, value: 0, weighted: 0 });
  });
  it("une valeur absente vaut 0 mais le lead est compté", () => {
    expect(pipelineSummary([lead("to_visit", null)], DEFAULT_STAGES).open).toEqual({ count: 1, value: 0, weighted: 0 });
  });
  it("arrondit la valeur pondérée à l'entier", () => {
    expect(pipelineSummary([lead("to_visit", 15)], DEFAULT_STAGES).open.weighted).toBe(2); // 1,5 → 2
  });
  it("suit les étapes personnalisées de l'entreprise", () => {
    const custom = [...DEFAULT_STAGES, { id: "x", key: "negociation", name: "Négociation", color: "#8e4ec6", probability: 75, kind: "open" as const, position: 6 }];
    expect(pipelineSummary([lead("negociation", 1000)], custom).open.weighted).toBe(750);
  });
  it("liste vide", () => {
    expect(pipelineSummary([], DEFAULT_STAGES)).toEqual({ open: { count: 0, value: 0, weighted: 0 }, won: { count: 0, value: 0 }, lost: { count: 0, value: 0 } });
  });
});

describe("constantes", () => {
  it("les étapes par défaut web sont celles de l'API (clés, couleurs, types)", () => {
    expect(DEFAULT_STAGES.map((s) => `${s.key}:${s.kind}:${s.color}`)).toEqual([
      "to_visit:open:#e5484d",
      "interested:open:#0868c9",
      "mockup_sent:open:rgba(34, 170, 94, 0.6)",
      "deposit_paid:open:#12c457",
      "won:won:#07625a",
      "lost:lost:#8a99a6",
    ]);
  });
  it("la palette ne contient que des couleurs #rrggbb distinctes", () => {
    expect(new Set(STAGE_COLORS).size).toBe(STAGE_COLORS.length);
    for (const c of STAGE_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});

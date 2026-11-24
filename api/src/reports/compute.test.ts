import { describe, expect, it } from "vitest";
import { funnel, pipelineByStage, type StageRef } from "./compute.js";

const stages: StageRef[] = [
  { key: "a", name: "À visiter", color: "#f00", kind: "open", probability: 10 },
  { key: "b", name: "Intéressé", color: "#00f", kind: "open", probability: 50 },
  { key: "won", name: "Gagné", color: "#0a0", kind: "won", probability: 100 },
  { key: "lost", name: "Perdu", color: "#999", kind: "lost", probability: 0 },
];
const lead = (id: string, status: string, v: number | null = null) => ({ id, status, estimatedValue: v });

describe("pipelineByStage", () => {
  it("la probabilité propre au lead prime sur celle de l'étape ; absente (null), on garde celle de l'étape", () => {
    const p = pipelineByStage(stages, [
      { id: "1", status: "b", estimatedValue: 1000, probability: 80 },
      { id: "2", status: "b", estimatedValue: 1000, probability: null },
      { id: "3", status: "b", estimatedValue: 1000, probability: 0 },
    ]);
    expect(p.openWeighted).toBe(800 + 500 + 0);
  });

  it("compte, additionne et pondère seulement les étapes ouvertes", () => {
    const p = pipelineByStage(stages, [lead("1", "a", 1000), lead("2", "b", 2000), lead("3", "b", null), lead("4", "won", 500), lead("5", "lost", 700), lead("6", "inconnue", 99)]);
    expect(p.stages.map((s) => [s.key, s.count, s.value, s.weighted])).toEqual([
      ["a", 1, 1000, 100],
      ["b", 2, 2000, 1000],
      ["won", 1, 500, 0],
      ["lost", 1, 700, 0],
    ]);
    expect(p).toMatchObject({ openCount: 3, openValue: 3000, openWeighted: 1100 });
  });
  it("pipeline vide", () => {
    expect(pipelineByStage(stages, [])).toMatchObject({ openCount: 0, openValue: 0, openWeighted: 0 });
  });
});

describe("funnel", () => {
  it("un lead a atteint une étape s'il y est ou s'il y est passé", () => {
    const f = funnel(
      stages,
      [lead("1", "a"), lead("2", "b"), lead("3", "lost"), lead("4", "won")],
      [{ leadId: "2", from: "a", to: "b" }, { leadId: "3", from: "a", to: "b" }, { leadId: "3", from: "b", to: "lost" }, { leadId: "4", from: "b", to: "won" }],
    );
    expect(f.cohort).toBe(4);
    expect(f.stages.map((s) => [s.key, s.reached])).toEqual([["a", 4], ["b", 3], ["won", 1]]);
    expect(f.stages[1]).toMatchObject({ ofCohort: 0.75, fromPrevious: 0.75 });
    expect(f.stages[2].fromPrevious).toBeCloseTo(1 / 3);
    expect(f).toMatchObject({ won: 1, lost: 1, inProgress: 2, winRate: 0.5 });
  });
  it("un lead passé directement à « Gagné » compte aux étapes ouvertes (taux jamais > 100 %)", () => {
    const f = funnel(stages, [lead("1", "won")], []);
    expect(f.stages.map((s) => s.reached)).toEqual([1, 1, 1]);
    expect(f.stages.every((s) => (s.fromPrevious ?? 0) <= 1)).toBe(true);
  });
  it("cohorte vide : aucun taux (null), pas de division par zéro", () => {
    const f = funnel(stages, [], []);
    expect(f.cohort).toBe(0);
    expect(f.winRate).toBeNull();
    expect(f.stages.every((s) => s.ofCohort === null && s.fromPrevious === null)).toBe(true);
  });
  it("aucun dossier tranché : pas de taux de réussite", () => {
    expect(funnel(stages, [lead("1", "a")], []).winRate).toBeNull();
  });
  it("ignore les déplacements de leads hors cohorte", () => {
    const f = funnel(stages, [lead("1", "a")], [{ leadId: "autre", from: "a", to: "b" }]);
    expect(f.stages[1].reached).toBe(0);
  });
});

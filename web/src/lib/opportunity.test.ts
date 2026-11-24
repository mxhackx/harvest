import { describe, expect, it } from "vitest";
import { closeDateLate, effectiveProbability, formatCloseDate, weightedValue } from "./opportunity";

const stages = [{ key: "a", probability: 10 }, { key: "b", probability: 50 }];

describe("opportunité", () => {
  it("la probabilité du lead prime, 0 compris ; sinon celle de l'étape ; étape inconnue : 0", () => {
    expect(effectiveProbability({ status: "b", probability: 80 }, stages)).toBe(80);
    expect(effectiveProbability({ status: "b", probability: 0 }, stages)).toBe(0);
    expect(effectiveProbability({ status: "b", probability: null }, stages)).toBe(50);
    expect(effectiveProbability({ status: "zz", probability: null }, stages)).toBe(0);
  });

  it("valeur pondérée : arrondie, null sans valeur estimée", () => {
    expect(weightedValue({ status: "b", probability: null, estimatedValue: 1001 }, stages)).toBe(501);
    expect(weightedValue({ status: "b", probability: 25, estimatedValue: 1000 }, stages)).toBe(250);
    expect(weightedValue({ status: "b", probability: 25, estimatedValue: null }, stages)).toBeNull();
  });

  it("date de conclusion : lisible, et en retard seulement si le lead est encore ouvert", () => {
    expect(formatCloseDate("2027-02-15")).toMatch(/15 févr\.? 2027/);
    const now = new Date(2027, 1, 16, 8);
    expect(closeDateLate("2027-02-15", true, now)).toBe(true);
    expect(closeDateLate("2027-02-16", true, now)).toBe(false); // le jour même n'est pas en retard
    expect(closeDateLate("2027-02-15", false, now)).toBe(false);
    expect(closeDateLate(null, true, now)).toBe(false);
  });
});

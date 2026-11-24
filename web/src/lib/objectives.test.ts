import { describe, expect, it } from "vitest";
import { barWidth, monthLabel, shiftMonth } from "./objectives";

describe("objectives", () => {
  it("change de mois, d'une année à l'autre aussi", () => {
    expect(shiftMonth("2026-11", 1)).toBe("2026-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("écrit le mois en français", () => {
    expect(monthLabel("2026-11")).toBe("novembre 2026");
  });
  it("borne la barre à 0–100, même pour un dépassement d'objectif", () => {
    expect(barWidth(null)).toBe(0);
    expect(barWidth(150)).toBe(100);
    expect(barWidth(37)).toBe(37);
  });
});

import { describe, expect, it } from "vitest";
import { daysLeft, daysLeftLabel } from "./trash";

describe("daysLeft", () => {
  const now = new Date("2026-11-24T12:00:00Z");
  it("compte les jours restants, arrondis au jour entamé", () => {
    expect(daysLeft("2026-12-24T12:00:00Z", now)).toBe(30);
    expect(daysLeft("2026-11-25T00:00:00Z", now)).toBe(1);
  });
  it("ne descend jamais sous zéro", () => {
    expect(daysLeft("2026-11-01T00:00:00Z", now)).toBe(0);
  });
  it("accorde le libellé", () => {
    expect(daysLeftLabel(0)).toBe("effacé aujourd'hui");
    expect(daysLeftLabel(1)).toBe("effacé dans 1 jour");
    expect(daysLeftLabel(12)).toBe("effacé dans 12 jours");
  });
});

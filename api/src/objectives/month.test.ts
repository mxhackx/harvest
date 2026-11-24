import { describe, expect, it } from "vitest";
import { monthBounds, monthStart, percent } from "./month.js";

describe("objectifs : mois et pourcentage", () => {
  it("lit un mois, avec ou sans jour, et refuse le reste", () => {
    expect(monthStart("2026-11")).toBe("2026-11-01");
    expect(monthStart("2026-11-24")).toBe("2026-11-01");
    for (const bad of ["2026-13", "2026-00", "novembre", "26-11", ""]) expect(monthStart(bad)).toBeNull();
  });
  it("borne le mois, décembre compris", () => {
    expect(monthBounds("2026-12-01").to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(monthBounds("2026-02-01").to.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
  it("pourcentage : rien sans objectif, peut dépasser 100", () => {
    expect(percent(5, 0)).toBeNull();
    expect(percent(5, 20)).toBe(25);
    expect(percent(30, 20)).toBe(150);
  });
});

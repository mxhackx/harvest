import { describe, expect, it } from "vitest";
import { circlePolygon, formatPeriod, progress, regionPhase } from "./waves";

describe("progress", () => {
  it("visités sur objectif, plafonné à 100 ; rien sans objectif", () => {
    expect(progress({ visited: 5, targetVisits: 20 })).toBe(25);
    expect(progress({ visited: 30, targetVisits: 20 })).toBe(100);
    expect(progress({ visited: 5, targetVisits: 0 })).toBeNull();
  });
});

describe("regionPhase", () => {
  const w = (regionId: string, phase: "planned" | "active" | "overdue" | "closed", endsOn = "2026-11-30") => ({ regionId, phase, endsOn });
  it("la vague la plus vivante colore la région", () => {
    expect(regionPhase([w("a", "closed"), w("a", "planned"), w("a", "active")], "a")).toBe("active");
    expect(regionPhase([w("a", "closed"), w("a", "overdue")], "a")).toBe("overdue");
    expect(regionPhase([w("a", "closed", "2026-01-01"), w("a", "closed", "2026-06-01")], "a")).toBe("closed");
  });
  it("null pour une région sans vague", () => {
    expect(regionPhase([w("b", "active")], "a")).toBeNull();
  });
});

describe("circlePolygon", () => {
  it("fait un anneau fermé dont les points sont à la bonne distance", () => {
    const ring = circlePolygon(2.4, 6.4, 10);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const [lng, lat] = ring[16]; // un quart de tour : plein nord
    expect(lng).toBeCloseTo(2.4, 5);
    expect((lat - 6.4) * 111.32).toBeCloseTo(10, 1);
  });
});

describe("formatPeriod", () => {
  it("un jour ou une période", () => {
    expect(formatPeriod("2026-11-24", "2026-11-24")).toBe("24 nov.");
    expect(formatPeriod("2026-11-24", "2026-11-30")).toBe("24 nov. – 30 nov.");
  });
});

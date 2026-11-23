import { describe, expect, it } from "vitest";
import { barWidth, fieldActions, pct, periodRange } from "./reports";

describe("pct", () => {
  it("arrondit, et affiche un tiret sans donnée", () => {
    expect(pct(0.756)).toBe("76 %");
    expect(pct(0)).toBe("0 %");
    expect(pct(1)).toBe("100 %");
    expect(pct(null)).toBe("—");
    expect(pct(Number.NaN)).toBe("—");
  });
});

describe("periodRange", () => {
  it("remonte du nombre de jours demandé jusqu'à maintenant", () => {
    const now = new Date("2026-06-30T12:00:00.000Z");
    expect(periodRange(30, now)).toEqual({ from: "2026-05-31T12:00:00.000Z", to: "2026-06-30T12:00:00.000Z" });
  });
});

describe("barWidth", () => {
  it("proportionnelle au maximum, jamais invisible, jamais au-delà de 100", () => {
    expect(barWidth(50, 100)).toBe(50);
    expect(barWidth(1, 1000)).toBe(2);
    expect(barWidth(0, 100)).toBe(0);
    expect(barWidth(10, 0)).toBe(0);
    expect(barWidth(200, 100)).toBe(100);
  });
});

describe("fieldActions", () => {
  it("additionne les actions de terrain", () => {
    expect(fieldActions({ calls: 2, messages: 1, visits: 3, emails: 0, notes: 4 })).toBe(10);
  });
});

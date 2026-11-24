import { describe, expect, it } from "vitest";
import { canTransition, computeTotals, lineTotal, nextNumber } from "./compute.js";

describe("computeTotals", () => {
  it("additionne les lignes (quantité décimale arrondie) et applique la taxe", () => {
    const lines = [
      { label: "Site vitrine", quantity: 1, unitPrice: 250_000 },
      { label: "Heures de formation", quantity: 2.5, unitPrice: 15_000 },
    ];
    expect(lineTotal(lines[1])).toBe(37_500);
    expect(computeTotals(lines, 18)).toEqual({ subtotal: 287_500, tax: 51_750, total: 339_250 });
    expect(computeTotals(lines, 0)).toEqual({ subtotal: 287_500, tax: 0, total: 287_500 });
    expect(computeTotals([], 18)).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });
  it("arrondit la taxe à l'unité", () => {
    expect(computeTotals([{ label: "x", quantity: 1, unitPrice: 105 }], 18)).toEqual({ subtotal: 105, tax: 19, total: 124 });
  });
});

describe("nextNumber", () => {
  const now = new Date("2026-11-24T10:00:00Z");
  it("commence à 1 chaque année et continue après le plus grand numéro", () => {
    expect(nextNumber([], now)).toBe("D-2026-0001");
    expect(nextNumber(["D-2026-0001", "D-2026-0007", "D-2025-0099"], now)).toBe("D-2026-0008");
    expect(nextNumber(["D-2025-0099"], now)).toBe("D-2026-0001");
  });
});

describe("canTransition", () => {
  it("brouillon → envoyé → accepté ou refusé, jamais en arrière", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "accepted")).toBe(true);
    expect(canTransition("sent", "declined")).toBe(true);
    expect(canTransition("draft", "accepted")).toBe(false);
    expect(canTransition("accepted", "draft")).toBe(false);
    expect(canTransition("declined", "sent")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { cleanLines, parseNumber, totals } from "./quotes";

describe("quotes", () => {
  it("calcule les mêmes totaux que l'API (quantité décimale, taxe arrondie)", () => {
    expect(totals([{ label: "a", quantity: 1, unitPrice: 250000 }, { label: "b", quantity: 2.5, unitPrice: 15000 }], 18)).toEqual({ subtotal: 287500, tax: 51750, total: 339250 });
    expect(totals([{ label: "x", quantity: 1, unitPrice: 105 }], 18)).toEqual({ subtotal: 105, tax: 19, total: 124 });
  });
  it("lit un nombre avec virgule ou espaces, refuse le vide, le texte et le négatif", () => {
    expect(parseNumber("2,5")).toBe(2.5);
    expect(parseNumber("15 000")).toBe(15000);
    for (const bad of ["", "abc", "-3"]) expect(parseNumber(bad)).toBeNull();
  });
  it("nettoie les lignes du formulaire : ignore les lignes vides, dit quelle ligne est fausse", () => {
    expect(cleanLines([{ label: "Site", quantity: "1", unitPrice: "250 000" }, { label: "", quantity: "", unitPrice: "" }])).toEqual({ ok: true, lines: [{ label: "Site", quantity: 1, unitPrice: 250000 }] });
    expect(cleanLines([{ label: "", quantity: "1", unitPrice: "10" }])).toEqual({ ok: false, message: "Ligne 1 : donnez un libellé." });
    expect(cleanLines([{ label: "a", quantity: "0", unitPrice: "10" }])).toMatchObject({ ok: false });
    expect(cleanLines([{ label: "a", quantity: "1,234", unitPrice: "10" }])).toMatchObject({ ok: false });
    expect(cleanLines([{ label: "a", quantity: "1", unitPrice: "10,5" }])).toMatchObject({ ok: false });
  });
});

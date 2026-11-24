import { describe, expect, it } from "vitest";
import { mergeCustom, type FieldDef } from "./custom.js";

const defs: FieldDef[] = [
  { id: "t", label: "Enseigne", type: "text", options: [] },
  { id: "n", label: "Effectif", type: "number", options: [] },
  { id: "d", label: "Prochain salon", type: "date", options: [] },
  { id: "s", label: "Taille", type: "select", options: ["Petite", "Grande"] },
];

describe("mergeCustom", () => {
  it("enregistre chaque valeur selon son type et efface avec null ou une chaîne vide", () => {
    const r = mergeCustom(defs, { t: "ancien", n: 3 }, { t: "  Soleil ", n: 12, d: "2026-12-01", s: "Grande" });
    expect(r).toEqual({ ok: true, value: { t: "Soleil", n: 12, d: "2026-12-01", s: "Grande" } });
    expect(mergeCustom(defs, { t: "x", n: 1 }, { t: null, n: "" })).toEqual({ ok: true, value: {} });
  });
  it("refuse une valeur du mauvais type, une date impossible, un choix inconnu ou un champ inconnu", () => {
    const bad = (input: Record<string, string | number | null>) => mergeCustom(defs, {}, input);
    expect(bad({ n: "douze" })).toMatchObject({ ok: false, field: "Effectif" });
    expect(bad({ d: "2026-02-31" })).toMatchObject({ ok: false, field: "Prochain salon" });
    expect(bad({ s: "Moyenne" })).toMatchObject({ ok: false, field: "Taille" });
    expect(bad({ inconnu: "x" })).toMatchObject({ ok: false });
  });
  it("retire les valeurs dont le champ n'existe plus", () => {
    expect(mergeCustom(defs, { orphelin: "x", t: "ok" }, {})).toEqual({ ok: true, value: { t: "ok" } });
  });
});

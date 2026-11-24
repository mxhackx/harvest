import { describe, expect, it } from "vitest";
import { parseCustomInput, parseOptions } from "./custom-fields";

describe("custom-fields", () => {
  it("lit une saisie selon le type : vide efface, nombre avec virgule ou espaces", () => {
    expect(parseCustomInput("text", "  Soleil ")).toBe("Soleil");
    expect(parseCustomInput("text", "  ")).toBeNull();
    expect(parseCustomInput("number", "1 250,5")).toBe(1250.5);
    expect(parseCustomInput("number", "douze")).toBe("douze"); // refusé ensuite par l'API, avec un message
    expect(parseCustomInput("date", "2026-12-01")).toBe("2026-12-01");
  });
  it("découpe les choix d'une liste sans doublon ni vide", () => {
    expect(parseOptions("Petite, Grande ; Moyenne\nGrande,,")).toEqual(["Petite", "Grande", "Moyenne"]);
  });
});

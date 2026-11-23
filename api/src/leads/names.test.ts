import { describe, expect, it } from "vitest";
import { baseName, MAX_NAME, pickUniqueName } from "./names.js";
import { duplicateKey } from "./import.js";

describe("pickUniqueName", () => {
  it("garde le nom s'il est libre", () => {
    expect(pickUniqueName("Pharmacie", [])).toBe("Pharmacie");
    expect(pickUniqueName("Pharmacie", ["Boulangerie"])).toBe("Pharmacie");
  });
  it("ajoute (1) puis (2)… pour les suivants", () => {
    expect(pickUniqueName("Pharmacie", ["Pharmacie"])).toBe("Pharmacie (1)");
    expect(pickUniqueName("Pharmacie", ["Pharmacie", "Pharmacie (1)"])).toBe("Pharmacie (2)");
    expect(pickUniqueName("Pharmacie", ["Pharmacie", "Pharmacie (1)", "Pharmacie (2)", "Pharmacie (3)"])).toBe("Pharmacie (4)");
  });
  it("ignore la casse et les espaces autour", () => {
    expect(pickUniqueName("  pharmacie ", ["PHARMACIE"])).toBe("pharmacie (1)");
    expect(pickUniqueName("Pharmacie", ["Pharmacie (1)"])).toBe("Pharmacie"); // la base est libre : on la garde
  });
  it("comble le premier trou de la numérotation", () => {
    expect(pickUniqueName("A", ["A", "A (1)", "A (3)"])).toBe("A (2)");
  });
  it("un nom déjà numéroté repart de sa base", () => {
    expect(pickUniqueName("Salon (1)", ["Salon", "Salon (1)"])).toBe("Salon (2)");
    expect(pickUniqueName("Salon (7)", ["Salon (7)"])).toBe("Salon (1)");
  });
  it("ne dépasse jamais la longueur maximale du nom", () => {
    const long = "x".repeat(MAX_NAME);
    const out = pickUniqueName(long, [long]);
    expect(out.length).toBeLessThanOrEqual(MAX_NAME);
    expect(out.endsWith(" (1)")).toBe(true);
    expect(pickUniqueName(long, [long, out]).endsWith(" (2)")).toBe(true);
  });
  it("accepte n'importe quel itérable", () => {
    expect(pickUniqueName("A", new Set(["a"]))).toBe("A (1)");
  });
});

describe("baseName", () => {
  it("retire le numéro final, et seulement lui", () => {
    expect(baseName("Pharmacie (12)")).toBe("Pharmacie");
    expect(baseName("Pharmacie (Étoile)")).toBe("Pharmacie (Étoile)");
    expect(baseName("Garage (2) Moderne")).toBe("Garage (2) Moderne");
    expect(baseName("(3)")).toBe("(3)");
  });
});

describe("duplicateKey et numérotation", () => {
  it("un lead renuméroté reste reconnu comme doublon de son original", () => {
    const a = duplicateKey({ name: "Pharmacie (1)", phone: "+229 11", address: "Rue 1" });
    const b = duplicateKey({ name: "Pharmacie", phone: "22911", address: "rue 1" });
    expect(a).toBe(b);
  });
});

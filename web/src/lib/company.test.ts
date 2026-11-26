import { describe, expect, it } from "vitest";
import { isInternationalPhone } from "./company";

describe("téléphone de l'entreprise", () => {
  it("exige l'indicatif du pays et tolère espaces et ponctuation", () => {
    expect(isInternationalPhone("+229 01 97 00 00 00")).toBe(true);
    expect(isInternationalPhone("+33 (6) 12-34-56-78")).toBe(true);
    expect(isInternationalPhone("97 00 00 00")).toBe(false);
    expect(isInternationalPhone("+229 abc")).toBe(false);
  });
});

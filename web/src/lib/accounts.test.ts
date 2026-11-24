import { describe, expect, it } from "vitest";
import { money, opportunitiesLabel } from "./accounts";

describe("accounts", () => {
  it("écrit les montants avec des espaces, et un tiret quand il n'y a rien", () => {
    expect(money(1250000).replace(/\s/g, " ")).toBe("1 250 000");
    expect(money(0)).toBe("—");
  });
  it("accorde le nombre d'opportunités", () => {
    expect(opportunitiesLabel(0)).toBe("Aucune opportunité");
    expect(opportunitiesLabel(1)).toBe("1 opportunité");
    expect(opportunitiesLabel(3)).toBe("3 opportunités");
  });
});

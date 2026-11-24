import { describe, expect, it } from "vitest";
import { THEME_SCRIPT, parseMode, resolveTheme } from "./theme-mode";

describe("theme-mode", () => {
  it("lit un choix valide, sinon suit le système", () => {
    expect(parseMode("dark")).toBe("dark");
    expect(parseMode("light")).toBe("light");
    for (const raw of [null, "", "sombre", "system"]) expect(parseMode(raw)).toBe("system");
  });
  it("le choix explicite l'emporte, « system » suit l'appareil", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  it("le script d'avant affichage utilise la même clé de stockage", () => {
    expect(THEME_SCRIPT).toContain("hivation.theme");
  });
});

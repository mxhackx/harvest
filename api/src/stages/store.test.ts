import { describe, expect, it } from "vitest";
import { closingFields, slugify, uniqueKey } from "./store.js";
import { COLOR_RE, DEFAULT_STAGES } from "./defaults.js";

describe("slugify / uniqueKey", () => {
  it("clé stable : sans accents ni ponctuation, en minuscules", () => {
    expect(slugify("Maquette envoyée")).toBe("maquette_envoyee");
    expect(slugify("  Négociation — 2e tour !! ")).toBe("negociation_2e_tour");
    expect(slugify("🔥🔥")).toBe("etape"); // rien d'exploitable : clé par défaut
    expect(slugify("x".repeat(100)).length).toBe(40);
  });
  it("jamais deux clés identiques dans une entreprise", () => {
    expect(uniqueKey("Gagné", ["to_visit"])).toBe("gagne");
    expect(uniqueKey("Gagné", ["gagne"])).toBe("gagne_2");
    expect(uniqueKey("Gagné", ["gagne", "gagne_2", "gagne_3"])).toBe("gagne_4");
  });
});

describe("closingFields", () => {
  const open = { closedAt: null, lostReason: "" };
  it("étape ouverte : aucune date de clôture, motif effacé", () => {
    expect(closingFields({ kind: "open" }, { closedAt: new Date(), lostReason: "Trop cher" })).toEqual({ closedAt: null, lostReason: "" });
  });
  it("étape gagnée : clôture datée (et conservée si elle existe déjà), motif effacé", () => {
    const before = new Date("2026-01-01T00:00:00Z");
    expect(closingFields({ kind: "won" }, { closedAt: before, lostReason: "x" })).toEqual({ closedAt: before, lostReason: "" });
    expect(closingFields({ kind: "won" }, open).closedAt).toBeInstanceOf(Date);
  });
  it("étape perdue : le motif fourni gagne, sinon l'ancien est conservé", () => {
    expect(closingFields({ kind: "lost" }, open, "Trop cher").lostReason).toBe("Trop cher");
    expect(closingFields({ kind: "lost" }, { closedAt: new Date(), lostReason: "Injoignable" }).lostReason).toBe("Injoignable");
    expect(closingFields({ kind: "lost" }, open).lostReason).toBe("");
  });
});

describe("étapes par défaut", () => {
  it("quatre étapes ouvertes du cahier puis « gagné » et « perdu », avec les couleurs de la carte", () => {
    expect(DEFAULT_STAGES.map((s) => s.key)).toEqual(["to_visit", "interested", "mockup_sent", "deposit_paid", "won", "lost"]);
    expect(DEFAULT_STAGES.map((s) => s.kind)).toEqual(["open", "open", "open", "open", "won", "lost"]);
    expect(DEFAULT_STAGES[0].color).toBe("#e5484d");
    expect(DEFAULT_STAGES[2].color).toMatch(/^rgba\(.*0\.6\)$/); // légèrement transparent
    expect(new Set(DEFAULT_STAGES.map((s) => s.key)).size).toBe(6);
  });
  it("probabilités croissantes, 100 % pour gagné et 0 % pour perdu", () => {
    const p = DEFAULT_STAGES.map((s) => s.probability);
    expect(p.slice(0, 4)).toEqual([...p.slice(0, 4)].sort((a, b) => a - b));
    expect(DEFAULT_STAGES.find((s) => s.kind === "won")!.probability).toBe(100);
    expect(DEFAULT_STAGES.find((s) => s.kind === "lost")!.probability).toBe(0);
  });
  it("toutes les couleurs sont valides", () => {
    for (const s of DEFAULT_STAGES) expect(COLOR_RE.test(s.color), s.color).toBe(true);
  });
});

describe("COLOR_RE", () => {
  it("accepte #rrggbb et rgb()/rgba(), refuse le reste (jamais de CSS arbitraire dans une couleur)", () => {
    for (const ok of ["#e5484d", "#ABCDEF", "rgb(1, 2, 3)", "rgba(34, 170, 94, 0.6)", "rgba(0,0,0,1)", "rgba(0,0,0,.5)"]) expect(COLOR_RE.test(ok), ok).toBe(true);
    for (const bad of ["red", "#fff", "#12345", "url(x)", "rgba(1,2,3,2)", "#e5484d; background:url(x)", "expression(alert(1))", "", "rgb(1,2)"]) expect(COLOR_RE.test(bad), bad).toBe(false);
  });
});

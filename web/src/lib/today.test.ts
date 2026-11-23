import { describe, expect, it } from "vitest";
import type { Lead } from "./api";
import { dayBounds, leadsOfTheDay } from "./today";

// Fuseau du test : Africa/Porto-Novo (UTC+1). « Aujourd'hui » = le 24 novembre 2026 local.
const NOW = new Date("2026-11-24T10:00:00+01:00");

const lead = (id: string, over: Partial<Lead> = {}): Lead =>
  ({ id, name: id, createdAt: "2026-11-01T10:00:00.000Z", visitedAt: null, ...over }) as Lead;

describe("dayBounds", () => {
  it("couvre la journée locale, fin exclue", () => {
    const { from, to } = dayBounds(NOW);
    expect(from.toISOString()).toBe("2026-11-23T23:00:00.000Z"); // minuit à Cotonou
    expect(to.toISOString()).toBe("2026-11-24T23:00:00.000Z");
  });
});

describe("leadsOfTheDay", () => {
  const none = new Set<string>();
  it("garde les leads créés aujourd'hui, pas ceux d'hier", () => {
    const out = leadsOfTheDay([lead("a", { createdAt: "2026-11-24T08:00:00.000Z" }), lead("b", { createdAt: "2026-11-23T08:00:00.000Z" })], none, NOW);
    expect(out.map((l) => l.id)).toEqual(["a"]);
  });
  it("garde les leads visités aujourd'hui", () => {
    const out = leadsOfTheDay([lead("a", { visitedAt: "2026-11-24T09:00:00.000Z" }), lead("b", { visitedAt: "2026-11-20T09:00:00.000Z" })], none, NOW);
    expect(out.map((l) => l.id)).toEqual(["a"]);
  });
  it("garde les leads qui ont un rendez-vous aujourd'hui, même anciens", () => {
    const out = leadsOfTheDay([lead("ancien"), lead("autre")], new Set(["ancien"]), NOW);
    expect(out.map((l) => l.id)).toEqual(["ancien"]);
  });
  it("les bornes sont celles du fuseau local : 00 h 00 est dedans, 23 h 59 la veille est dehors", () => {
    const out = leadsOfTheDay(
      [
        lead("minuit", { createdAt: "2026-11-23T23:00:00.000Z" }), // 00:00 locale le 24
        lead("veille", { createdAt: "2026-11-23T22:59:59.000Z" }), // 23:59:59 locale le 23
        lead("demain", { createdAt: "2026-11-24T23:00:00.000Z" }), // 00:00 locale le 25 : fin exclue
        lead("soir", { createdAt: "2026-11-24T22:59:59.000Z" }), // 23:59:59 locale le 24
      ],
      none,
      NOW,
    );
    expect(out.map((l) => l.id)).toEqual(["minuit", "soir"]);
  });
  it("ne répète pas un lead qui remplit plusieurs critères", () => {
    const l = lead("tout", { createdAt: "2026-11-24T08:00:00.000Z", visitedAt: "2026-11-24T09:00:00.000Z" });
    expect(leadsOfTheDay([l], new Set(["tout"]), NOW)).toHaveLength(1);
  });
  it("conserve l'ordre d'entrée et gère le vide", () => {
    expect(leadsOfTheDay([], none, NOW)).toEqual([]);
    const all = [lead("1", { createdAt: "2026-11-24T08:00:00.000Z" }), lead("2", { createdAt: "2026-11-24T07:00:00.000Z" })];
    expect(leadsOfTheDay(all, none, NOW).map((l) => l.id)).toEqual(["1", "2"]);
  });
  it("ne modifie pas la liste d'entrée", () => {
    const all = [lead("x")];
    leadsOfTheDay(all, none, NOW);
    expect(all).toHaveLength(1);
  });
});

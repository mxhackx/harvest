import { afterEach, describe, expect, it } from "vitest";
import type { CalEvent } from "./api";
import { addDays, addMonths, dayKey, eventsByDay, formatDayLong, formatMonth, fromInputs, gridRange, monthGrid, sameDay, startOfMonth, toInputs } from "./calendar";

const TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = TZ;
});

const ev = (id: string, startsAt: string): CalEvent => ({ id, title: id, kind: "visit", startsAt, endsAt: null, notes: "", done: false, leadId: null, leadName: null, ownerId: "u" });

describe("monthGrid", () => {
  it("novembre 2026 : commence un lundi et couvre 6 semaines entières", () => {
    const g = monthGrid(new Date(2026, 10, 1)); // le 1er est un dimanche
    expect(g).toHaveLength(42);
    expect(dayKey(g[0])).toBe("2026-10-26");
    expect(dayKey(g[41])).toBe("2026-12-06");
  });
  it("février 2027 : exactement 4 semaines quand le mois commence un lundi", () => {
    const g = monthGrid(new Date(2027, 1, 1));
    expect(g).toHaveLength(28);
    expect(dayKey(g[0])).toBe("2027-02-01");
    expect(dayKey(g[27])).toBe("2027-02-28");
  });
  it("propriétés : toujours des semaines entières du lundi au dimanche, tous les jours du mois présents", () => {
    for (let m = 0; m < 24; m++) {
      const month = new Date(2026, m, 1);
      const g = monthGrid(month);
      expect(g.length % 7).toBe(0);
      expect(g[0].getDay()).toBe(1);
      const inMonth = g.filter((d) => d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear());
      expect(inMonth).toHaveLength(new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
      // pas de trou ni de doublon
      g.slice(1).forEach((d, i) => expect(dayKey(d)).toBe(dayKey(addDays(g[i], 1))));
    }
  });
  it("année bissextile : février 2028 compte 29 jours", () => {
    const g = monthGrid(new Date(2028, 1, 1));
    expect(g.filter((d) => d.getMonth() === 1)).toHaveLength(29);
  });
  it("reste correct autour du passage à l'heure d'été / d'hiver", () => {
    process.env.TZ = "Europe/Paris"; // le 25 octobre 2026 dure 25 h
    const g = monthGrid(new Date(2026, 9, 1));
    expect(g.every((d) => d.getHours() === 0)).toBe(true);
    expect(new Set(g.map(dayKey)).size).toBe(g.length);
  });
});

describe("gridRange", () => {
  it("couvre la grille ; la fin est le lendemain du dernier jour (période semi-ouverte)", () => {
    const month = new Date(2026, 10, 1);
    const { from, to } = gridRange(month);
    expect(dayKey(from)).toBe("2026-10-26");
    expect(dayKey(to)).toBe("2026-12-07");
    expect(Math.round((+to - +from) / 86_400_000)).toBe(42);
  });
  it("reste sous la limite de 62 jours de l'API, pour tous les mois", () => {
    for (let m = 0; m < 36; m++) {
      const { from, to } = gridRange(new Date(2026, m, 1));
      expect((+to - +from) / 86_400_000).toBeLessThanOrEqual(62);
    }
  });
});

describe("saisie de date et d'heure", () => {
  it("convertit une saisie valide en instant, et inversement", () => {
    const d = fromInputs("2026-11-24", "09:05")!;
    expect(d.toISOString()).toBe("2026-11-24T08:05:00.000Z"); // UTC+1
    expect(toInputs(d.toISOString())).toEqual({ date: "2026-11-24", time: "09:05" });
  });
  it("refuse les dates et heures impossibles que Date « corrigerait » en silence", () => {
    expect(fromInputs("2026-02-31", "09:00")).toBeNull();
    expect(fromInputs("2027-02-29", "09:00")).toBeNull();
    expect(fromInputs("2026-13-01", "09:00")).toBeNull();
    expect(fromInputs("2026-11-24", "25:00")).toBeNull();
    expect(fromInputs("2026-11-24", "09:60")).toBeNull();
  });
  it("accepte le 29 février d'une année bissextile", () => {
    expect(fromInputs("2028-02-29", "12:00")).not.toBeNull();
  });
  it("refuse les formats inattendus", () => {
    for (const [d, t] of [["24/11/2026", "09:00"], ["2026-11-24", "9h"], ["", ""], ["2026-11-24", ""], ["2026-1-4", "09:00"]]) expect(fromInputs(d, t)).toBeNull();
  });
});

describe("jours et mois", () => {
  it("dayKey ajoute les zéros", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("addMonths passe l'année et tombe toujours sur le 1er", () => {
    expect(dayKey(addMonths(new Date(2026, 11, 15), 1))).toBe("2027-01-01");
    expect(dayKey(addMonths(new Date(2026, 0, 31), -1))).toBe("2025-12-01");
    expect(dayKey(startOfMonth(new Date(2026, 5, 17, 14, 30)))).toBe("2026-06-01");
  });
  it("sameDay ignore l'heure", () => {
    expect(sameDay(new Date(2026, 10, 24, 0, 0), new Date(2026, 10, 24, 23, 59))).toBe(true);
    expect(sameDay(new Date(2026, 10, 24), new Date(2026, 10, 25))).toBe(false);
  });
  it("formate en français", () => {
    expect(formatMonth(new Date(2026, 10, 1))).toBe("novembre 2026");
    expect(formatDayLong(new Date(2026, 10, 24))).toBe("mardi 24 novembre");
  });
});

describe("eventsByDay", () => {
  it("groupe par jour dans le fuseau de l'utilisateur, et trie par heure", () => {
    const m = eventsByDay([ev("tard", "2026-11-24T14:00:00.000Z"), ev("tôt", "2026-11-24T07:00:00.000Z"), ev("minuit", "2026-11-24T23:30:00.000Z")]);
    expect(m.get("2026-11-24")!.map((e) => e.id)).toEqual(["tôt", "tard"]);
    // 23 h 30 UTC = 00 h 30 le lendemain à Cotonou : ce n'est pas le même jour
    expect(m.get("2026-11-25")!.map((e) => e.id)).toEqual(["minuit"]);
  });
  it("ne modifie pas le tableau d'entrée", () => {
    const input = [ev("b", "2026-11-24T10:00:00.000Z"), ev("a", "2026-11-24T08:00:00.000Z")];
    eventsByDay(input);
    expect(input.map((e) => e.id)).toEqual(["b", "a"]);
  });
  it("liste vide", () => {
    expect(eventsByDay([]).size).toBe(0);
  });
});

describe("endFromInputs", () => {
  const start = new Date(2026, 10, 24, 9, 0);
  it("rien si la fin est vide, la fin saisie si elle suit le début, invalide sinon", async () => {
    const { endFromInputs } = await import("./calendar");
    expect(endFromInputs("2026-11-24", start, "")).toBeNull();
    expect(endFromInputs("2026-11-24", start, "10:30")).toEqual(new Date(2026, 10, 24, 10, 30));
    expect(endFromInputs("2026-11-24", start, "09:00")).toBe("invalid");
    expect(endFromInputs("2026-11-24", start, "08:00")).toBe("invalid");
    expect(endFromInputs("2026-11-24", start, "25:99")).toBe("invalid");
  });
});

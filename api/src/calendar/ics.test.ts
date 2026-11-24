import { describe, expect, it } from "vitest";
import { toIcs } from "./ics.js";

const now = new Date("2026-11-24T08:00:00Z");
const ev = (over = {}) => ({ id: "e1", title: "Visite", startsAt: new Date("2026-12-01T09:00:00Z"), endsAt: null, notes: "", leadName: null, ...over });

describe("toIcs", () => {
  it("produit un calendrier valide, avec une heure par défaut quand la fin est inconnue", () => {
    const ics = toIcs([ev()], "Hivation", now);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261201T090000Z\r\nDTEND:20261201T100000Z");
    expect(ics).toContain("UID:e1@hivation");
  });
  it("garde la fin saisie, et l'ignore si elle ne suit pas le début", () => {
    expect(toIcs([ev({ endsAt: new Date("2026-12-01T11:30:00Z") })], "H", now)).toContain("DTEND:20261201T113000Z");
    expect(toIcs([ev({ endsAt: new Date("2026-12-01T08:00:00Z") })], "H", now)).toContain("DTEND:20261201T100000Z");
  });
  it("échappe les caractères spéciaux et coupe les lignes longues à 75 octets", () => {
    const ics = toIcs([ev({ title: "A, B; C\\D", notes: "ligne 1\nligne 2 " + "é".repeat(80), leadName: "Boulangerie" })], "H", now);
    expect(ics).toContain("SUMMARY:A\\, B\; C\\\\D");
    expect(ics).toContain("Lead : Boulangerie\\nligne 1");
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});

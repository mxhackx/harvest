import { describe, expect, it } from "vitest";
import { parsePins, togglePin } from "./pins";

describe("togglePin", () => {
  it("épingle puis désépingle", () => {
    expect(togglePin([], "/leads")).toEqual(["/leads"]);
    expect(togglePin(["/leads", "/taches"], "/leads")).toEqual(["/taches"]);
  });
});

describe("parsePins", () => {
  it("lit une liste valide", () => {
    expect(parsePins('["/dashboard/crm/leads","/dashboard/calendar"]')).toEqual(["/dashboard/crm/leads", "/dashboard/calendar"]);
  });
  it("met à jour les anciennes adresses épinglées", () => {
    expect(parsePins('["/leads","/dashboard/taches"]')).toEqual(["/dashboard/crm/leads", "/dashboard/crm/tasks"]);
  });
  it("ignore le contenu corrompu ou hostile", () => {
    expect(parsePins("pas du json")).toEqual([]);
    expect(parsePins('{"a":1}')).toEqual([]);
    expect(parsePins('["/ok", 3, "https://evil.com", null]')).toEqual(["/ok"]);
  });
  it("limite la taille de la liste", () => {
    expect(parsePins(JSON.stringify(Array.from({ length: 50 }, (_, i) => `/p${i}`)))).toHaveLength(20);
  });
});

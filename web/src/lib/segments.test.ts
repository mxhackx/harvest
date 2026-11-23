import { describe, expect, it } from "vitest";
import { sanitizeSegment } from "./segments";

describe("sanitizeSegment", () => {
  it("conserve une configuration valide", () => {
    const c = { tab: "mine", query: "port", sort: "value", filters: { visit: "to_visit", position: "with", sector: "Santé" } };
    expect(sanitizeSegment(c)).toEqual(c);
  });
  it("remplace les valeurs inconnues par les défauts", () => {
    expect(sanitizeSegment({ tab: "x", sort: 3, filters: { visit: "?", position: null } })).toEqual({
      tab: "all", query: "", sort: "recent", filters: { visit: "all", position: "all", sector: "all" },
    });
  });
  it("supporte n'importe quelle entrée", () => {
    for (const v of [null, undefined, 5, "texte", []]) expect(sanitizeSegment(v).tab).toBe("all");
  });
});

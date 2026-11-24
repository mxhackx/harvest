import { describe, expect, it } from "vitest";
import { cleanQuery, isEmpty } from "./search";

describe("search", () => {
  it("ignore une recherche trop courte et rogne les espaces", () => {
    expect(cleanQuery(" a ")).toBeNull();
    expect(cleanQuery("")).toBeNull();
    expect(cleanQuery("  soleil ")).toBe("soleil");
  });
  it("sait si rien n'a été trouvé", () => {
    expect(isEmpty({ leads: [], contacts: [], tasks: [] })).toBe(true);
    expect(isEmpty({ leads: [{ id: "1", name: "x", city: "", sector: "" }], contacts: [], tasks: [] })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { safeNext } from "./navigation";

describe("safeNext", () => {
  it("accepte un chemin interne, avec sa requête", () => {
    expect(safeNext("/invitation?token=abc")).toBe("/invitation?token=abc");
    expect(safeNext("/leads")).toBe("/leads");
  });
  it("refuse tout ce qui sort du site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", null, undefined]) {
      expect(safeNext(bad as string | null)).toBeNull();
    }
  });
});

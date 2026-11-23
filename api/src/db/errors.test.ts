import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./errors.js";

describe("isUniqueViolation", () => {
  it("reconnaît le code brut ou enveloppé", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation(new Error("x", { cause: { code: "23505" } }))).toBe(true);
  });
  it("ignore le reste", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME } from "./theme";

const css = readFileSync("src/app/globals.css", "utf8");
const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase();

describe("THEME", () => {
  it("reste identique aux jetons de globals.css (source unique des couleurs)", () => {
    expect(THEME).toEqual({ accent: token("accent"), ink: token("ink"), muted: token("muted"), page: token("page") });
  });
});

describe("globals.css", () => {
  it("n'utilise plus l'ancienne police serif", () => {
    expect(css).not.toMatch(/font-serif|fraunces/i);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
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

describe("lisibilité en mode sombre", () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? files(path.join(dir, f)) : /\.tsx$/.test(f) ? [path.join(dir, f)] : []));
  it("aucun fond « ink » avec du texte blanc : en sombre, ink est clair (utiliser bg-inverse et text-on-inverse)", () => {
    for (const f of files("src")) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => expect(/bg-ink\b(?!\/)/.test(line) && /text-white/.test(line), `${f}:${i + 1}`).toBe(false));
    }
  });
});

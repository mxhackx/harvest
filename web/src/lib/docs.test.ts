import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOCS, findDoc, flattenDocs } from "./docs";

const appDir = path.join(process.cwd(), "src/app");
const pages = flattenDocs();

describe("arborescence de la documentation", () => {
  it("les adresses sont uniques et sous /docs", () => {
    const hrefs = pages.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h === "/docs" || h.startsWith("/docs/"))).toBe(true);
  });
  it("chaque page enfant est rangée sous son parent", () => {
    for (const p of DOCS) for (const c of p.children ?? []) expect(c.href.startsWith(p.href + "/")).toBe(true);
  });
  it("à plat : le parent précède ses enfants (ordre de lecture)", () => {
    const order = pages.map((p) => p.href);
    expect(order.indexOf("/docs/import")).toBeLessThan(order.indexOf("/docs/import/csv"));
    expect(order.indexOf("/docs/import/csv")).toBeLessThan(order.indexOf("/docs/import/json"));
    expect(order[0]).toBe("/docs");
  });
  it("findDoc retrouve une page, et rien pour une adresse inconnue", () => {
    expect(findDoc("/docs/import/csv")?.title).toBe("Format CSV");
    expect(findDoc("/docs/nope")).toBeUndefined();
  });
});

describe("référencement de la documentation", () => {
  it("titres uniques, courts, sans le nom du site (le gabarit l'ajoute)", () => {
    const titles = pages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const t of titles) expect(t.length).toBeLessThanOrEqual(40);
  });
  it("descriptions uniques, entre 60 et 170 caractères (affichage complet dans les résultats de recherche)", () => {
    const descs = pages.map((p) => p.description);
    expect(new Set(descs).size).toBe(descs.length);
    for (const p of pages) {
      expect(p.description.length, p.href).toBeGreaterThanOrEqual(60);
      expect(p.description.length, p.href).toBeLessThanOrEqual(170);
    }
  });
});

describe("pages réelles", () => {
  it("chaque page de l'arborescence a son fichier page.tsx (donc une URL valide dans le sitemap)", () => {
    for (const p of pages) expect(existsSync(path.join(appDir, p.href, "page.tsx")), p.href).toBe(true);
  });
  it("aucune page de documentation n'est oubliée de l'arborescence", () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name === "page.tsx") found.push("/" + path.relative(appDir, path.dirname(full)).split(path.sep).join("/"));
      }
    };
    walk(path.join(appDir, "docs"));
    expect(found.sort()).toEqual(pages.map((p) => p.href).sort());
  });
});

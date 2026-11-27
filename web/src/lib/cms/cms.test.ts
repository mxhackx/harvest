import { describe, expect, it } from "vitest";
import { exportProject } from "./export";
import { addPage, drop, find, newSite, walk } from "./model";
import { styleOf } from "./style";
import { crc32, zip } from "./zip";

describe("arbre d'un site", () => {
  const site = newSite("Café Jardin");
  const root = site.pages[0].root;
  const [hero, menu] = root.children!;

  it("glisser-déposer déplace un élément, mais jamais dans lui-même", () => {
    expect(drop(root, menu.id, hero.id, "before").children![0].id).toBe(menu.id);
    expect(find(drop(root, menu.id, hero.id, "inside"), hero.id)!.children!.at(-1)!.id).toBe(menu.id);
    expect(drop(root, hero.id, hero.children![0].id, "inside")).toBe(root);
  });
  it("les pages ont des adresses uniques, jamais « api »", () => {
    expect(addPage(addPage(site, "Nos Plats"), "nos plats").pages.slice(-2).map((p) => p.path)).toEqual(["nos-plats", "nos-plats-2"]);
    expect(addPage(site, "API").pages.at(-1)!.path).toBe("api-2");
  });
  it("n'accepte qu'une couleur ou une variable", () => {
    const n = { ...hero, props: { background: "red;} body{display:none", color: "$accent" } };
    expect(styleOf(n, site, false)).toMatchObject({ color: "var(--accent)" });
    expect(styleOf(n, site, false).background).toBeUndefined();
    expect(styleOf({ ...hero, props: { borderWidth: 1, borderColor: "$texte/15" } }, site, false).border).toBe("1px solid color-mix(in srgb, var(--texte) 15%, transparent)");
  });
});

describe("export Next.js", () => {
  const site = newSite("Café Jardin");
  const title = walk(site.pages[0].root).find((n) => n.textStyle === "h1")!;
  title.text = '</h1><script>alert(1)</script>{process.env.DATABASE_URL}';
  walk(site.pages[0].root).find((n) => n.type === "button")!.href = "javascript:alert(1)";
  const files = exportProject(site);

  it("produit front, back et base", () => {
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["package.json", "app/page.tsx", "app/carte/page.tsx", "app/globals.css", "app/api/contact/route.ts", "db/schema.ts", ".env.example"]));
  });
  it("le texte saisi reste du texte, et un lien dangereux est neutralisé", () => {
    const page = files["app/page.tsx"] as string;
    expect(page).toContain(`{${JSON.stringify(title.text)}}`);
    expect(page).not.toContain("javascript:");
  });
  it("l'archive est un ZIP", () => {
    expect([...zip(files).slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
  });
});

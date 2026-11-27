import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../../../../registry/src/build";
import { fetchCatalog, parseCatalog, parseNode } from "./library";
import { walk } from "./model";

const out = path.resolve(process.cwd(), "../registry/public");

describe("registre de composants", () => {
  const files = buildRegistry();

  it("les fichiers publiés sont à jour (sinon : npm run registry:build)", () => {
    for (const [name, content] of Object.entries(files)) expect(readFileSync(path.join(out, name), "utf8"), name).toBe(content);
    expect(readdirSync(path.join(out, "r")).sort()).toEqual(Object.keys(files).filter((f) => f.startsWith("r/")).map((f) => f.slice(2)).sort());
  });

  it("chaque composant publié entre dans le CMS avec des identifiants neufs", () => {
    const items = parseCatalog(JSON.parse(files["r/registry.json"]));
    expect(items.length).toBeGreaterThanOrEqual(15);
    expect(new Set(items.map((i) => i.name)).size).toBe(items.length);
    const first = walk(parseNode(items[3].node)!).map((n) => n.id);
    const again = walk(parseNode(items[3].node)!).map((n) => n.id);
    expect(first.some((id) => again.includes(id))).toBe(false);
  });

  it("ce qui vient d'ailleurs est filtré", () => {
    const node = parseNode({ type: "frame", name: "x", props: { background: "url(https://pirate.test)", gap: "9px;}" }, onclick: "alert(1)", children: [
      { type: "button", name: "b", props: {}, text: "ok", href: "javascript:alert(1)" },
      { type: "image", name: "i", props: {}, src: "https://pirate.test/pixel.png" },
    ] })!;
    expect(node.props).toEqual({});
    expect(Object.keys(node)).not.toContain("onclick");
    expect(node.children![0].href).toBe("#");
    expect(node.children![1].src).toBe("");
    expect(parseNode({ type: "script", name: "x" })).toBeNull();
    expect(parseNode({ type: "frame", name: "x", children: Array(200).fill({ type: "text", name: "t" }) })).toBeNull();
    expect(typeof fetchCatalog).toBe("function");
  });
});

import { describe, expect, it } from "vitest";
import { checkSite, moveBlock, newSite } from "./site";

describe("site du CMS", () => {
  it("un squelette neuf échoue aux contrôles tant qu'il n'est pas rempli", () => {
    const site = newSite("Café Jardin");
    const failed = checkSite(site).filter((c) => !c.ok).map((c) => c.code);
    expect(failed).toEqual(["C04", "C05", "C06"]);
    const filled = { ...site, blocks: site.blocks.map((b) => ({ ...b, phone: "+229 01 97 00 00 00", logo: "data:image/webp;base64,AA==", text: b.type === "hero" ? "Terrasse à Cotonou." : b.text })) };
    expect(checkSite(filled).every((c) => c.ok)).toBe(true);
  });
  it("déplace un bloc sans sortir de la liste", () => {
    const site = newSite("x");
    expect(moveBlock(site, site.blocks[0].id, -1)).toBe(site);
    expect(moveBlock(site, site.blocks[1].id, -1).blocks[0].type).toBe("menu");
  });
});

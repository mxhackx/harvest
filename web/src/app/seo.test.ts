import { BRAND } from "@/lib/brand";
import { describe, expect, it } from "vitest";
import { flattenDocs } from "@/lib/docs";
import { SITE, SHARE_IMAGE, docMetadata, jsonLd, pageMetadata } from "@/lib/seo";
import manifest from "./manifest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("SITE", () => {
  it("normalise l'URL du site (pas de barre oblique finale)", () => {
    expect(SITE.url).toBe("https://harvest.example");
  });
});

describe("pageMetadata", () => {
  const base = { title: "Leads", description: "Gérez vos leads.", path: "/leads" };
  it("page publique : indexable, canonique, partage complet", () => {
    const m = pageMetadata(base);
    expect(m.title).toBe("Leads");
    expect(m.alternates?.canonical).toBe("/leads");
    expect(m.robots).toEqual({ index: true, follow: true });
    expect(m.openGraph).toMatchObject({ title: `Leads · ${BRAND.name}`, description: "Gérez vos leads.", url: "/leads", locale: "fr_FR", siteName: BRAND.name });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: `Leads · ${BRAND.name}` });
  });
  it("page privée : jamais indexée ni suivie", () => {
    expect(pageMetadata({ ...base, index: false }).robots).toEqual({ index: false, follow: false });
  });
  it("redéclare l'image de partage (un openGraph de page remplace celui du layout)", () => {
    const m = pageMetadata(base);
    expect((m.openGraph as { images: unknown[] }).images).toEqual([SHARE_IMAGE]);
    expect((m.twitter as { images: unknown[] }).images).toEqual([SHARE_IMAGE.url]);
    expect(SHARE_IMAGE).toMatchObject({ width: 1200, height: 630 });
  });
});

describe("docMetadata", () => {
  it("chaque page de doc a un titre, une description et un canonique propres, et est indexable", () => {
    for (const p of flattenDocs()) {
      const m = docMetadata(p.href);
      expect(m.title).toBe(`${p.title} — Documentation`);
      expect(m.description).toBe(p.description);
      expect(m.alternates?.canonical).toBe(p.href);
      expect(m.robots).toEqual({ index: true, follow: true });
    }
  });
  it("échoue bruyamment sur une page inconnue plutôt que de publier des métadonnées vides", () => {
    expect(() => docMetadata("/docs/inconnue")).toThrow(/inconnue/);
  });
});

describe("jsonLd", () => {
  it("échappe « < » : un titre ne peut pas fermer la balise script", () => {
    const out = jsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("robots.txt", () => {
  const r = robots();
  const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules) as { userAgent: string; allow: string[]; disallow: string[] };
  it("laisse l'accueil, la connexion et la documentation, ferme l'espace connecté", () => {
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toEqual(["/", "/login", "/docs"]);
    expect(rule.disallow).toEqual(["/dashboard"]);
  });
  it("annonce le sitemap", () => {
    expect(r.sitemap).toBe("https://harvest.example/sitemap.xml");
  });
});

describe("sitemap.xml", () => {
  const urls = sitemap().map((e) => e.url);
  it("contient l'accueil, la connexion et toutes les pages de documentation, en URL absolues", () => {
    expect(urls).toContain("https://harvest.example");
    expect(urls).toContain("https://harvest.example/login");
    for (const p of flattenDocs()) expect(urls).toContain(`https://harvest.example${p.href}`);
    expect(urls.every((u) => u === "https://harvest.example" || u.startsWith("https://harvest.example/"))).toBe(true);
  });
  it("ne contient jamais une page privée", () => {
    for (const priv of ["/dashboard", "/leads", "/calendrier", "/onboarding", "/templates"]) expect(urls.some((u) => u.includes(priv)), priv).toBe(false);
  });
  it("sans doublon", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("manifest", () => {
  it("décrit l'application installable", () => {
    const m = manifest();
    expect(m).toMatchObject({ name: BRAND.name, short_name: BRAND.name, lang: "fr", start_url: "/dashboard", display: "standalone", theme_color: "#0868c9", background_color: "#ffffff" });
    expect(m.icons?.map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
  });
});

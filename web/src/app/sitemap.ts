import type { MetadataRoute } from "next";
import { flattenDocs } from "@/lib/docs";
import { docsUrl } from "@/lib/hosts";
import { SITE } from "@/lib/seo";

// Uniquement les pages publiques de la vitrine (la connexion vit sur le domaine de l'application) : jamais l'espace connecté (/dashboard) ni l'onboarding.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    ...flattenDocs().map((p) => ({ url: docsUrl(p.href, SITE.url), changeFrequency: "monthly" as const, priority: p.href === "/docs" ? 0.8 : 0.7 })),
  ];
}

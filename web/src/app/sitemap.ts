import type { MetadataRoute } from "next";
import { flattenDocs } from "@/lib/docs";
import { SITE } from "@/lib/seo";

// Uniquement les pages publiques : jamais le tableau de bord, les leads, le calendrier ni l'onboarding.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/login`, changeFrequency: "monthly", priority: 0.6 },
    ...flattenDocs().map((p) => ({ url: `${SITE.url}${p.href}`, changeFrequency: "monthly" as const, priority: p.href === "/docs" ? 0.8 : 0.7 })),
  ];
}

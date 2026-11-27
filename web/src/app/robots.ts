import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

// L'espace connecté (/dashboard) est privé : la page d'accueil, la connexion et la documentation sont publiques.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/login", "/docs"], disallow: ["/dashboard", "/cms"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}

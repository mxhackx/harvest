import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

// L'application est privée : seuls la page de connexion et la documentation sont destinées aux moteurs de recherche.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/login", "/docs"], disallow: ["/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}

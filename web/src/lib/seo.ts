import { BRAND } from "./brand";
import type { Metadata } from "next";
import { findDoc } from "./docs";

export const SITE = {
  name: BRAND.name,
  /** URL publique du site (sert aux liens canoniques, au sitemap et aux aperçus de partage). */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  title: `${BRAND.name} — prospection et suivi de leads sur le terrain`,
  description:
    `${BRAND.name} aide les équipes commerciales à repérer, visiter et suivre leurs leads : carte de tournée, pipeline, calendrier, import et export CSV et JSON.`,
  locale: "fr_FR",
  themeColor: "#0868c9",
} as const;

/** Image de partage générée par app/opengraph-image.tsx. */
export const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${BRAND.name} — prospection et suivi de leads sur le terrain` };

type PageSeo = {
  /** Titre court de la page ; le modèle du layout ajoute « · » et le nom de la marque. */
  title: string;
  description: string;
  /** Chemin canonique, ex. « /docs/import ». */
  path: string;
  /** false pour les pages privées : elles ne doivent jamais apparaître dans un moteur de recherche. */
  index?: boolean;
};

export function pageMetadata({ title, description, path, index = true }: PageSeo): Metadata {
  const full = `${title} · ${SITE.name}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    // Une page qui définit son propre openGraph remplace celui du layout, image comprise : on la redéclare ici.
    openGraph: { type: "website", siteName: SITE.name, locale: SITE.locale, title: full, description, url: path, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title: full, description, images: [SHARE_IMAGE.url] },
  };
}

/** Données structurées sérialisées sans risque d'injection (`<` échappé pour ne pas fermer la balise script). */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** Métadonnées d'une page de documentation, tirées de l'arborescence (titre et description uniques par page). */
export function docMetadata(href: string): Metadata {
  const page = findDoc(href);
  if (!page) throw new Error(`Page de documentation inconnue : ${href}`);
  return pageMetadata({ title: `${page.title} — Documentation`, description: page.description, path: href });
}

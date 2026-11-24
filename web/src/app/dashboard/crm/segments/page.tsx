import { ROUTES } from "@/lib/routes";
import { SegmentsPage } from "@/components/segments-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Segments",
  description: "Vos listes de leads qui se mettent à jour selon des critères.",
  path: ROUTES.segments,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <SegmentsPage />;
}

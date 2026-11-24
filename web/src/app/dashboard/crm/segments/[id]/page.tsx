import { ROUTES } from "@/lib/routes";
import { SegmentPage } from "@/components/segment-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Segment",
  description: "Un segment : ses critères, sa taille et ses leads.",
  path: ROUTES.segments,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <SegmentPage />;
}

import { ROUTES } from "@/lib/routes";
import { DuplicatesPage } from "@/components/duplicates-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Doublons",
  description: "Les leads qui semblent identiques, à fusionner en un seul.",
  path: ROUTES.duplicates,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <DuplicatesPage />;
}

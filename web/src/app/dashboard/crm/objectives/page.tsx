import { ROUTES } from "@/lib/routes";
import { ObjectivesPage } from "@/components/objectives-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Objectifs",
  description: "Les objectifs du mois de chaque commercial, comparés au réel.",
  path: ROUTES.objectives,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <ObjectivesPage />;
}

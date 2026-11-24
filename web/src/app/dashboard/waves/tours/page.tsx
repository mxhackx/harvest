import { ROUTES } from "@/lib/routes";
import { ToursPage } from "@/components/tours-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Tournées",
  description: "Planifiez vos visites : choisissez les prospects, calculez l'itinéraire entre eux.",
  path: ROUTES.tours,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <ToursPage />;
}

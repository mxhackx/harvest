import { ROUTES } from "@/lib/routes";
import { LeadPage } from "@/components/lead-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Fiche lead",
  description: "Étape, informations, activité et contacts d'un lead.",
  path: ROUTES.leads,
  index: false,
});

// Espace connecté : rendu côté client ; l'identifiant est lu dans l'URL par le composant.
export const instant = false;

export default function Page() {
  return <LeadPage />;
}

import { ROUTES } from "@/lib/routes";
import { CompanyPage } from "@/components/company-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Entreprise",
  description: "La photo, l'e-mail, le téléphone et les informations de votre entreprise.",
  path: ROUTES.company,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <CompanyPage />;
}

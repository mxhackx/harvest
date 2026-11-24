import { ROUTES } from "@/lib/routes";
import { FieldsPage } from "@/components/fields-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Champs personnalisés",
  description: "Les informations en plus que vous saisissez sur chaque lead.",
  path: ROUTES.fields,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <FieldsPage />;
}

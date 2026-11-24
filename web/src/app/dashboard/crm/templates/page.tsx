import { ROUTES } from "@/lib/routes";
import { BRAND } from "@/lib/brand";
import { TemplatesPage } from "@/components/templates-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Modèles de messages",
  description: `Modèles de messages de votre CRM ${BRAND.name}.`,
  path: ROUTES.templates,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <TemplatesPage />;
}

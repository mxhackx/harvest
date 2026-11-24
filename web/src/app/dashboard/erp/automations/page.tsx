import { ROUTES } from "@/lib/routes";
import { AutomationsPage } from "@/components/automations-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Automatisations",
  description: "Des règles qui répartissent les nouveaux leads et relancent ceux sans suite.",
  path: ROUTES.automations,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <AutomationsPage />;
}

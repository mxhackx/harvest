import { ROUTES } from "@/lib/routes";
import { ReportsPage } from "@/components/reports-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Rapports",
  description: "Pipeline en valeur, conversion par étape et activité par personne.",
  path: ROUTES.reports,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <ReportsPage />;
}

import { ROUTES } from "@/lib/routes";
import { WorkflowsPage } from "@/components/workflows/workflows-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Workflow",
  description: "Dessinez des chaînes d'étapes : un déclencheur, des agents, des conditions et des validations.",
  path: ROUTES.workflows,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <WorkflowsPage />;
}

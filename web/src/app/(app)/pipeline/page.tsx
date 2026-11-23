import { PipelineSettings } from "@/components/pipeline-settings";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Pipeline",
  description: "Configurez les étapes du pipeline : noms, couleurs, probabilités, gagné et perdu.",
  path: "/pipeline",
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <PipelineSettings />;
}

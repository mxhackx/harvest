import { ROUTES } from "@/lib/routes";
import { KbPage } from "@/components/kb-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Base de connaissances",
  description: "Les réponses fréquentes de l'équipe.",
  path: ROUTES.kb,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <KbPage />;
}

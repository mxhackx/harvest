import { ROUTES } from "@/lib/routes";
import { WavesPage } from "@/components/waves-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Vagues",
  description: "Vos vagues de prospection : une région, une période, un objectif et un bilan.",
  path: ROUTES.waves,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <WavesPage />;
}

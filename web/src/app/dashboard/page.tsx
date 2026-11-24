import { ROUTES } from "@/lib/routes";
import { Dashboard } from "@/components/dashboard";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Tableau de bord",
  description: "Vos leads sur la carte de tournée et ce qui vous attend aujourd’hui.",
  path: ROUTES.home,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <Dashboard />;
}

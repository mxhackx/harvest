import { ROUTES } from "@/lib/routes";
import { TrashPage } from "@/components/trash-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Corbeille",
  description: "Les leads supprimés, restaurables pendant 30 jours.",
  path: ROUTES.trash,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <TrashPage />;
}

import { ROUTES } from "@/lib/routes";
import { RegionsPage } from "@/components/regions-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Régions",
  description: "Les zones que vous prospectez, avec leur centre et leur rayon.",
  path: ROUTES.regions,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <RegionsPage />;
}

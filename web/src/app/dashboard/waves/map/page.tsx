import { ROUTES } from "@/lib/routes";
import { WavesMapPage } from "@/components/waves-map-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Carte",
  description: "Le globe et la carte : régions et leads colorés selon le statut de leur vague.",
  path: ROUTES.map,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <WavesMapPage />;
}

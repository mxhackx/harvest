import { ROUTES } from "@/lib/routes";
import { QuotePage } from "@/components/quote-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Devis",
  description: "Un devis : lignes, totaux, statut et impression.",
  path: ROUTES.leads,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <QuotePage />;
}

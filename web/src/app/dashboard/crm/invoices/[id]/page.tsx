import { ROUTES } from "@/lib/routes";
import { InvoicePage } from "@/components/invoice-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Facture",
  description: "Une facture : lignes, totaux, statut et impression.",
  path: ROUTES.invoices,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <InvoicePage />;
}

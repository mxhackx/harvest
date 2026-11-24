import { ROUTES } from "@/lib/routes";
import { InvoicesPage } from "@/components/invoices-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Factures",
  description: "Vos factures et ce qu'il reste à encaisser.",
  path: ROUTES.invoices,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <InvoicesPage />;
}

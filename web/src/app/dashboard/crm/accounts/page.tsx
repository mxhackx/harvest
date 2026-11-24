import { ROUTES } from "@/lib/routes";
import { AccountsPage } from "@/components/accounts-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Comptes",
  description: "Vos entreprises clientes et leurs opportunités.",
  path: ROUTES.accounts,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <AccountsPage />;
}

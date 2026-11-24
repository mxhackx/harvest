import { ROUTES } from "@/lib/routes";
import { AccountPage } from "@/components/account-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Compte",
  description: "Une entreprise cliente et ses opportunités.",
  path: ROUTES.accounts,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <AccountPage />;
}

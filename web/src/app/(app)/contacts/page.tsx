import { BRAND } from "@/lib/brand";
import { ContactsPage } from "@/components/contacts-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Contacts",
  description: `Contacts de votre CRM ${BRAND.name}.`,
  path: "/contacts",
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <ContactsPage />;
}

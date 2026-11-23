import { LeadsPage } from "@/components/leads-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Leads",
  description: "Gérez vos leads : board par étape, tableau, import et export.",
  path: "/leads",
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <LeadsPage />;
}

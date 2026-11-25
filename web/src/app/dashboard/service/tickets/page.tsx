import { ROUTES } from "@/lib/routes";
import { TicketsPage } from "@/components/tickets-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Tickets",
  description: "Les demandes et réclamations de vos clients.",
  path: ROUTES.tickets,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <TicketsPage />;
}

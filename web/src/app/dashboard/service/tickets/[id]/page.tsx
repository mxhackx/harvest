import { ROUTES } from "@/lib/routes";
import { TicketPage } from "@/components/ticket-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Ticket",
  description: "Un ticket : état, responsable et commentaires.",
  path: ROUTES.tickets,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <TicketPage />;
}

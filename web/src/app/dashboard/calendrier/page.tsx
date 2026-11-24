import { ROUTES } from "@/lib/routes";
import { CalendarPage } from "@/components/calendar-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Calendrier",
  description: "Planifiez vos visites, appels et relances.",
  path: ROUTES.calendar,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <CalendarPage />;
}

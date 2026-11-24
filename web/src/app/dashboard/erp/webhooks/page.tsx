import { ROUTES } from "@/lib/routes";
import { WebhooksPage } from "@/components/webhooks-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Webhooks",
  description: "Prévenez un autre outil dès qu'un lead change.",
  path: ROUTES.webhooks,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <WebhooksPage />;
}

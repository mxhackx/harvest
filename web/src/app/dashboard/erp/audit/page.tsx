import { ROUTES } from "@/lib/routes";
import { AuditPage } from "@/components/audit-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Journal d'audit",
  description: "Qui a fait quoi, et quand, dans votre entreprise.",
  path: ROUTES.audit,
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <AuditPage />;
}

import { TeamPage } from "@/components/team-page";
import { pageMetadata } from "@/lib/seo";

// Page privée : jamais indexée par les moteurs de recherche.
export const metadata = pageMetadata({
  title: "Équipe",
  description: "Membres, rôles, invitations et équipes de l'entreprise.",
  path: "/equipe",
  index: false,
});

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <TeamPage />;
}

import { LeadsPage } from "@/components/leads-page";

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <LeadsPage />;
}

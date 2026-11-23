import { Dashboard } from "@/components/dashboard";

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function Page() {
  return <Dashboard />;
}

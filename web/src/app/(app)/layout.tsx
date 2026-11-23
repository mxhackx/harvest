import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";

// Tout l'espace connecté est privé : on le dit une fois ici pour qu'une future page ne l'oublie pas.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Espace connecté : rendu entièrement côté client après lecture de la session, pas de navigation « instantanée ».
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}

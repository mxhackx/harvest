"use client";

import { createContext, useContext } from "react";
import type { Me } from "./api";

export type Session = {
  me: Me;
  /** Entreprise active (la première pour l'instant ; un sélecteur viendra avec le multi-espaces). */
  companyId: string;
  company: Me["memberships"][number]["company"];
};

const Ctx = createContext<Session | null>(null);
export const SessionProvider = Ctx.Provider;

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession doit être utilisé dans l'espace connecté");
  return s;
}

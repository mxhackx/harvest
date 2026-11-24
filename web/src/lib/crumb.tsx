"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Crumb = { label: string | null; set: (label: string | null) => void };
const Ctx = createContext<Crumb>({ label: null, set: () => {} });

/** Dernier maillon du fil d'Ariane d'une page de détail (ex. le nom du lead) : la page le déclare, l'en-tête l'affiche. */
export function CrumbProvider({ children }: { children: ReactNode }) {
  const [label, set] = useState<string | null>(null);
  const value = useMemo(() => ({ label, set }), [label]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCrumbLabel = () => useContext(Ctx).label;

/** À appeler dans une page de détail : affiche `label` à la fin du fil d'Ariane, et le retire en quittant la page. */
export function useCrumb(label: string | null | undefined) {
  const { set } = useContext(Ctx);
  useEffect(() => {
    set(label ?? null);
    return () => set(null);
  }, [label, set]);
}

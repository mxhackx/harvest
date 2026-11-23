"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { useSession } from "./session";
import { DEFAULT_STAGES, type Stage } from "./stages";

type StagesState = { stages: Stage[]; loaded: boolean; reload: () => Promise<void> };
const Ctx = createContext<StagesState | null>(null);

/** Étapes du pipeline de l'entreprise : une source unique pour le board, la carte, les formulaires et les filtres. */
export function StagesProvider({ children }: { children: ReactNode }) {
  const { companyId } = useSession();
  const [stages, setStages] = useState<Stage[] | null>(null);

  const reload = useCallback(
    () =>
      api<Stage[]>("/stages", { companyId })
        .then(setStages)
        .catch(() => undefined), // en cas d'échec on garde les étapes déjà chargées, ou celles par défaut
    [companyId],
  );

  useEffect(() => {
    reload();
    const refresh = () => document.visibilityState === "visible" && reload();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [reload]);

  const value = useMemo(() => ({ stages: stages ?? DEFAULT_STAGES, loaded: stages !== null, reload }), [stages, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStages(): StagesState {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStages doit être utilisé dans l'espace connecté");
  return s;
}

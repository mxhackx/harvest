"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ApiError, api, errorMessage, type Lead } from "./api";
import { QUEUE_EVENT, pending, type QueueEventDetail } from "./offline";
import { applyOptimistic, applyPending, leadIdOf } from "./offline-rules";
import { useSession } from "./session";

type LeadsState = {
  /** null tant que le premier chargement n'est pas terminé */
  leads: Lead[] | null;
  /** pour les mises à jour immédiates (glisser-déposer) avant la confirmation du serveur */
  setLeads: Dispatch<SetStateAction<Lead[] | null>>;
  reload: () => Promise<void>;
  error: string | null;
  clearError: () => void;
};

const Ctx = createContext<LeadsState | null>(null);

const REFRESH_MS = 30_000;

/**
 * Source unique des leads pour toutes les pages : la carte, l'accueil et la liste voient la même
 * donnée. Elle se recharge au retour sur l'onglet et toutes les 30 s, pour suivre les changements
 * faits par les autres membres de l'équipe.
 */
export function LeadsProvider({ children }: { children: ReactNode }) {
  const { me, companyId } = useSession();
  const canRead = me.memberships[0].permissions.some((p) => p.permission === "lead:read");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      canRead
        ? api<Lead[]>("/leads", { companyId })
            // les gestes faits hors connexion et pas encore envoyés restent visibles, même si la copie lue ne les connaît pas
            .then(async (l) => applyPending(l, await pending().catch(() => [])))
            .then((l) => {
              setLeads(l);
              setError(null);
            })
            .catch((e) => setError(errorMessage(e instanceof ApiError ? e.code : null)))
        : Promise.resolve(),
    [companyId, canRead],
  );

  // Gestes faits hors connexion : on les voit tout de suite à l'écran ; au retour du réseau, on recharge la vraie donnée.
  useEffect(() => {
    const onQueue = (e: Event) => {
      const d = (e as CustomEvent<QueueEventDetail>).detail;
      if (d.type === "queued") {
        const id = leadIdOf(d.entry.path);
        if (id) setLeads((cur) => cur && cur.map((l) => (l.id === id ? applyOptimistic(l, d.entry) : l)));
      } else reload();
    };
    window.addEventListener(QUEUE_EVENT, onQueue);
    return () => window.removeEventListener(QUEUE_EVENT, onQueue);
  }, [reload]);

  useEffect(() => {
    reload();
    const refreshIfVisible = () => document.visibilityState === "visible" && reload();
    const timer = setInterval(refreshIfVisible, REFRESH_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [reload]);

  const value = useMemo(() => ({ leads, setLeads, reload, error, clearError: () => setError(null) }), [leads, reload, error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLeads(): LeadsState {
  const s = useContext(Ctx);
  if (!s) throw new Error("useLeads doit être utilisé dans l'espace connecté");
  return s;
}

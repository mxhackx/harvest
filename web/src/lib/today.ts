import { useCallback, useEffect, useState } from "react";
import { addDays, startOfDay } from "./calendar";
import { api, type CalEvent, type Lead } from "./api";

/** Début (inclus) et fin (exclue) de la journée de `now`, dans le fuseau de l'utilisateur. */
export function dayBounds(now: Date = new Date()) {
  const from = startOfDay(now);
  return { from, to: addDays(from, 1) };
}

const isOnDay = (iso: string | null, from: Date, to: Date) => iso !== null && new Date(iso) >= from && new Date(iso) < to;

/**
 * Les leads « de la journée » : ceux qu'on a créés, visités ou planifiés (rendez-vous au calendrier) aujourd'hui.
 * `eventLeadIds` = identifiants des leads qui ont un rendez-vous aujourd'hui.
 */
export function leadsOfTheDay(leads: Lead[], eventLeadIds: ReadonlySet<string>, now: Date = new Date()): Lead[] {
  const { from, to } = dayBounds(now);
  return leads.filter((l) => eventLeadIds.has(l.id) || isOnDay(l.createdAt, from, to) || isOnDay(l.visitedAt, from, to));
}

/**
 * Leads qui ont un rendez-vous aujourd'hui. Sans le droit de lire le calendrier, ou si la requête échoue,
 * la liste reste vide : la carte retombe alors sur les leads créés ou visités aujourd'hui.
 */
export function useTodayEventLeadIds(enabled: boolean, companyId: string): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(() => {
    if (!enabled) return Promise.resolve();
    const { from, to } = dayBounds();
    return api<CalEvent[]>(`/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, { companyId })
      .then((list) => setIds(new Set(list.flatMap((e) => (e.leadId ? [e.leadId] : [])))))
      .catch(() => undefined);
  }, [enabled, companyId]);

  useEffect(() => {
    load();
    const refresh = () => document.visibilityState === "visible" && load();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  return ids;
}

"use client";

import { useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { periodRange } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { Notice, Panel } from "./ui";

type Forecast = {
  forecast: { months: { month: string | null; count: number; value: number; weighted: number }[]; value: number; weighted: number };
  kpis: { won: number; lost: number; conversionRate: number | null; avgCycleDays: number | null; wonValue: number; avgDeal: number | null };
  byRep: { userId: string; name: string; won: number; wonValue: number }[];
};

const n = (v: number) => v.toLocaleString("fr-FR");
const monthLabel = (m: string | null) => (m ? new Date(`${m}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "Sans date de conclusion");

/** Indicateurs de performance, prévision de chiffre d'affaires et chiffre d'affaires par commercial, sur la période choisie. */
export function ForecastPanels({ days }: { days: number }) {
  const { companyId } = useSession();
  const [data, setData] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const { from, to } = periodRange(days);
    api<Forecast>(`/reports/forecast?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { companyId })
      .then((r) => live && (setData(r), setError(null)))
      .catch((e) => live && setError(describeError(e)));
    return () => {
      live = false;
    };
  }, [days, companyId]);

  if (error) return <Notice onClose={() => setError(null)}>{error}</Notice>;
  if (!data) return null;
  const { kpis, forecast, byRep } = data;
  const tiles: [string, string][] = [
    ["Taux de conversion", kpis.conversionRate === null ? "—" : `${kpis.conversionRate} %`],
    ["Durée moyenne d’une vente", kpis.avgCycleDays === null ? "—" : `${kpis.avgCycleDays.toLocaleString("fr-FR")} j`],
    ["Chiffre d’affaires gagné", n(kpis.wonValue)],
    ["Panier moyen", kpis.avgDeal === null ? "—" : n(kpis.avgDeal)],
  ];
  const max = Math.max(...forecast.months.map((m) => m.value), 1);
  return (
    <>
      <section aria-label="Indicateurs de performance">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-card border border-border bg-card p-4">
              <dt className="text-small text-muted">{label}</dt>
              <dd className="font-mono text-stat font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-small text-muted">Calculés sur les affaires clôturées pendant la période : {kpis.won} gagnée{kpis.won > 1 ? "s" : ""}, {kpis.lost} perdue{kpis.lost > 1 ? "s" : ""}.</p>
      </section>

      <Panel title="Prévision de chiffre d’affaires">
        {forecast.months.length === 0 ? (
          <p className="text-small text-muted">Aucune affaire en cours avec une valeur estimée. Renseignez la valeur et la date de conclusion espérée des leads.</p>
        ) : (
          <>
            <p className="mb-3 text-small text-muted">
              Les affaires en cours, par mois de conclusion espérée. <strong>Pondéré</strong> = valeur × probabilité de l’étape (ou du lead). Total espéré <span className="font-mono">{n(forecast.value)}</span>, pondéré <span className="font-mono font-semibold text-ink">{n(forecast.weighted)}</span>.
            </p>
            <ul className="flex flex-col gap-3">
              {forecast.months.map((m) => (
                <li key={m.month ?? "none"}>
                  <div className="flex items-baseline justify-between gap-3 text-small">
                    <span className="font-medium capitalize">{monthLabel(m.month)} <span className="font-normal text-muted">· {m.count} affaire{m.count > 1 ? "s" : ""}</span></span>
                    <span className="font-mono">{n(m.weighted)} <span className="text-muted">sur {n(m.value)}</span></span>
                  </div>
                  <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-field" aria-hidden>
                    <div className="absolute inset-y-0 left-0 rounded-full bg-accent-soft" style={{ width: `${(m.value / max) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(m.weighted / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {byRep.length > 0 && (
        <Panel title="Chiffre d’affaires par commercial">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-rule text-left text-muted">
                <th className="py-2 font-medium">Commercial</th>
                <th className="py-2 text-right font-medium">Affaires gagnées</th>
                <th className="py-2 text-right font-medium">Chiffre d’affaires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {byRep.map((r) => (
                <tr key={r.userId}>
                  <td className="py-2 font-medium">{r.name || "—"}</td>
                  <td className="py-2 text-right font-mono">{r.won}</td>
                  <td className="py-2 text-right font-mono">{n(r.wonValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

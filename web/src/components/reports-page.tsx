"use client";

import { useEffect, useState } from "react";
import { api, describeError, formatValue } from "@/lib/api";
import { PERIODS, barWidth, fieldActions, pct, periodRange, type Report } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { Notice, Panel } from "./ui";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-card px-[18px] py-4">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-stat font-semibold leading-tight">{value}</dd>
      {hint && <p className="mt-1 text-small text-muted">{hint}</p>}
    </div>
  );
}

function Bar({ width, color }: { width: number; color: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-field" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

/** Rapports : pipeline en valeur, conversion par étape, motifs de perte, activité par personne. */
export function ReportsPage() {
  const { companyId } = useSession();
  const [days, setDays] = useState<number>(30);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const { from, to } = periodRange(days);
    api<Report>(`/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { companyId })
      .then((r) => live && (setReport(r), setError(null)))
      .catch((e) => live && setError(describeError(e)));
    return () => {
      live = false;
    };
  }, [days, companyId]);

  const maxValue = report ? Math.max(...report.pipeline.stages.map((s) => s.value), 0) : 0;
  const maxCount = report ? Math.max(...report.pipeline.stages.map((s) => s.count), 0) : 0;
  const byValue = maxValue > 0; // sans valeurs estimées, les barres comptent les leads

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title font-semibold">Rapports</h1>
        <div role="group" aria-label="Période" className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              aria-pressed={days === p.days}
              onClick={() => setDays(p.days)}
              className={`h-9 rounded-full border px-3 text-small font-medium ${days === p.days ? "border-accent-press bg-accent text-white" : "border-frame bg-card hover:bg-field"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {!report ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Pipeline ouvert" value={formatValue(report.pipeline.openValue)} hint={`${report.pipeline.openCount} leads en cours`} />
            <Kpi label="Valeur pondérée" value={formatValue(report.pipeline.openWeighted)} hint="valeur × probabilité de l’étape" />
            <Kpi label="Gagné sur la période" value={formatValue(report.closed.wonValue)} hint={`${report.closed.won} lead${report.closed.won > 1 ? "s" : ""} gagné${report.closed.won > 1 ? "s" : ""}`} />
            <Kpi label="Taux de réussite" value={pct(report.funnel.winRate)} hint={`${report.funnel.won} gagnés, ${report.funnel.lost} perdus (leads créés sur la période)`} />
          </dl>

          <Panel title="Pipeline par étape" description={byValue ? "Barre : valeur estimée des leads de l’étape." : "Barre : nombre de leads (aucune valeur estimée renseignée)."}>
            <ul className="flex flex-col gap-3">
              {report.pipeline.stages.map((s) => (
                <li key={s.key} className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)_200px] sm:items-center sm:gap-4">
                  <span className="flex items-center gap-2 text-body">
                    <span aria-hidden className="size-2.5 rounded-full border border-ink/15" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <Bar width={barWidth(byValue ? s.value : s.count, byValue ? maxValue : maxCount)} color={s.color} />
                  <span className="text-small text-muted sm:text-right">
                    <span className="font-mono text-ink">{s.count}</span> lead{s.count > 1 ? "s" : ""} · <span className="font-mono text-ink">{formatValue(s.value)}</span>
                    {s.kind === "open" && s.value > 0 && <> · pond. <span className="font-mono">{formatValue(s.weighted)}</span></>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Conversion par étape" description={`Leads créés sur la période : ${report.funnel.cohort}. Une étape est « atteinte » si le lead y est ou y est passé.`}>
            {report.funnel.cohort === 0 ? (
              <p className="text-small text-muted">Aucun lead créé sur cette période : essayez une période plus longue.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {report.funnel.stages.map((s) => (
                  <li key={s.key} className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)_200px] sm:items-center sm:gap-4">
                    <span className="flex items-center gap-2 text-body">
                      <span aria-hidden className="size-2.5 rounded-full border border-ink/15" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <Bar width={(s.ofCohort ?? 0) * 100} color={s.color} />
                    <span className="text-small text-muted sm:text-right">
                      <span className="font-mono text-ink">{s.reached}</span> · {pct(s.ofCohort)} de la cohorte
                      {s.fromPrevious !== null && <> · <span className="font-medium text-ink">{pct(s.fromPrevious)}</span> de l’étape précédente</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Motifs de perte" description="Leads passés en « perdu » sur la période.">
            {report.closed.lostReasons.length === 0 ? (
              <p className="text-small text-muted">Aucun lead perdu sur la période.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {report.closed.lostReasons.map((r) => (
                  <li key={r.reason} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_32px] items-center gap-4">
                    <span className="truncate text-body">{r.reason}</span>
                    <Bar width={barWidth(r.count, report.closed.lostReasons[0].count)} color="var(--color-neutral)" />
                    <span className="text-right font-mono text-small">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Activité par personne" description="Entrées saisies dans les fils d’activité des leads que vous pouvez voir, sur la période." flush>
            {report.reps.length === 0 ? (
              <p className="px-[18px] py-4 text-small text-muted">Aucune activité sur la période.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-body">
                  <thead>
                    <tr className="border-b border-rule text-right text-small font-medium text-muted">
                      <th className="px-4 py-2 text-left">Nom</th>
                      <th className="px-3 py-2">Leads créés</th>
                      <th className="px-3 py-2">Appels</th>
                      <th className="px-3 py-2">Messages</th>
                      <th className="px-3 py-2">Visites</th>
                      <th className="px-3 py-2">E-mails</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2">Étapes</th>
                      <th className="px-3 py-2">Tâches faites</th>
                      <th className="px-3 py-2">Gagnés</th>
                      <th className="px-4 py-2">Valeur gagnée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {report.reps.map((r) => (
                      <tr key={r.userId} className="text-right font-mono">
                        <td className="px-4 py-2 text-left font-sans font-medium">
                          {r.name}
                          <span className="ml-2 text-small font-normal text-muted">{fieldActions(r)} actions</span>
                        </td>
                        <td className="px-3 py-2">{r.leadsCreated}</td>
                        <td className="px-3 py-2">{r.calls}</td>
                        <td className="px-3 py-2">{r.messages}</td>
                        <td className="px-3 py-2">{r.visits}</td>
                        <td className="px-3 py-2">{r.emails}</td>
                        <td className="px-3 py-2">{r.notes}</td>
                        <td className="px-3 py-2">{r.stageChanges}</td>
                        <td className="px-3 py-2">{r.tasksDone}</td>
                        <td className="px-3 py-2">{r.won}</td>
                        <td className="px-4 py-2">{formatValue(r.wonValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { barWidth, monthLabel, shiftMonth, type ObjectiveRow } from "@/lib/objectives";
import { useSession } from "@/lib/session";
import { Button, Field, Modal, Notice } from "./ui";

const thisMonth = () => new Date().toISOString().slice(0, 7);

function Bar({ label, done, target, percent, money }: { label: string; done: number; target: number; percent: number | null; money?: boolean }) {
  const fmt = (n: number) => (money ? n.toLocaleString("fr-FR") : String(n));
  return (
    <div>
      <div className="mb-1 flex justify-between text-small">
        <span>{label}</span>
        <span className="font-mono">{target > 0 ? `${fmt(done)} / ${fmt(target)} · ${percent} %` : `${fmt(done)} · pas d’objectif`}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuenow={percent ?? 0} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-field">
        <div className="h-full rounded-full bg-accent" style={{ width: `${barWidth(percent)}%` }} />
      </div>
    </div>
  );
}

/** Objectifs du mois par commercial, comparés au réel. Chacun voit les siens ; les responsables fixent ceux de l'équipe. */
export function ObjectivesPage() {
  const { me, companyId } = useSession();
  const canSet = me.memberships[0].permissions.some((p) => p.permission === "objective:update");
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState<ObjectiveRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ObjectiveRow | null>(null);

  const load = useCallback(
    () => api<{ items: ObjectiveRow[] }>(`/objectives?month=${month}`, { companyId }).then((r) => setRows(r.items)).catch((e) => setError(describeError(e))),
    [companyId, month],
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Objectifs</h1>
          <p className="text-small text-muted">Visites, leads gagnés et valeur gagnée du mois, comparés à l’objectif de chacun.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="h-9 w-auto" aria-label="Mois précédent" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            ‹
          </Button>
          <span className="min-w-36 text-center font-medium capitalize">{monthLabel(month)}</span>
          <Button variant="secondary" className="h-9 w-auto" aria-label="Mois suivant" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            ›
          </Button>
        </div>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {rows === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.userId} className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{r.name}</p>
                {canSet && (
                  <Button variant="secondary" className="h-8 w-auto" onClick={() => setEditing(r)}>
                    Fixer les objectifs
                  </Button>
                )}
              </div>
              <Bar label="Visites" done={r.done.visits} target={r.target.visits} percent={r.percent.visits} />
              <Bar label="Leads gagnés" done={r.done.won} target={r.target.won} percent={r.percent.won} />
              <Bar label="Valeur gagnée" done={r.done.value} target={r.target.value} percent={r.percent.value} money />
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <TargetsForm
          row={editing}
          month={month}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TargetsForm({ row, month, onClose, onSaved }: { row: ObjectiveRow; month: string; onClose: () => void; onSaved: () => void }) {
  const { companyId } = useSession();
  const [visits, setVisits] = useState(String(row.target.visits));
  const [won, setWon] = useState(String(row.target.won));
  const [value, setValue] = useState(String(row.target.value));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const num = (s: string) => Math.max(0, Math.floor(Number(s.replace(/\s/g, "")) || 0));

  const save = async () => {
    setBusy(true);
    try {
      await api("/objectives", { method: "PUT", companyId, body: { userId: row.userId, month, targetVisits: num(visits), targetWon: num(won), targetValue: num(value) } });
      onSaved();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };
  return (
    <Modal title={`Objectifs de ${row.name}`} description={`${monthLabel(month)} · laissez 0 pour ne pas fixer d’objectif`} onClose={onClose} width="max-w-[420px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Visites" inputMode="numeric" value={visits} onChange={(e) => setVisits(e.target.value)} />
        <Field label="Leads gagnés" inputMode="numeric" value={won} onChange={(e) => setWon(e.target.value)} />
        <Field label="Valeur gagnée" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button className="sm:w-auto" loading={busy} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

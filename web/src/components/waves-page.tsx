"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { PHASE_LABEL, PHASE_TOKEN, formatPeriod, progress, type LeadBrief, type Region, type Wave } from "@/lib/waves";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice, Select } from "./ui";

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Vagues de prospection : une région, une période, un objectif de visites, puis un bilan à la clôture. */
export function WavesPage() {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const [waves, setWaves] = useState<Wave[] | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Wave | "new" | null>(null);
  const [closing, setClosing] = useState<Wave | null>(null);
  const [revisit, setRevisit] = useState<Wave | null>(null);

  const load = useCallback(
    () =>
      Promise.all([api<Wave[]>("/waves", { companyId }), api<Region[]>("/regions", { companyId })])
        .then(([w, r]) => {
          setWaves(w);
          setRegions(r);
        })
        .catch((e) => setError(describeError(e))),
    [companyId],
  );
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (w: Wave) => {
    if (!window.confirm(`Supprimer la vague « ${w.name} » ?`)) return;
    try {
      await api(`/waves/${w.id}`, { method: "DELETE", companyId });
      await load();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const groups: { title: string; items: Wave[] }[] = [
    { title: "En cours", items: (waves ?? []).filter((w) => w.phase === "active" || w.phase === "overdue") },
    { title: "À venir", items: (waves ?? []).filter((w) => w.phase === "planned") },
    { title: "Clôturées", items: (waves ?? []).filter((w) => w.phase === "closed") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Vagues</h1>
          <p className="text-small text-muted">Une région à la fois : ce qui est fait, ce qui reste, et le bilan quand la vague se termine.</p>
        </div>
        {perms.includes("wave:create") && regions.length > 0 && (
          <Button className="h-9 w-auto" onClick={() => setForm("new")}>
            <PlusIcon size={16} /> Nouvelle vague
          </Button>
        )}
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {waves === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : waves.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">
          {regions.length === 0 ? (
            <>
              Commencez par définir vos <Link href={ROUTES.regions} className="text-link underline">régions</Link>, puis planifiez une vague.
            </>
          ) : (
            "Aucune vague pour l’instant. Planifiez la première : une région, une semaine, un objectif de visites."
          )}
        </p>
      ) : (
        groups.map((g) =>
          g.items.length === 0 ? null : (
            <section key={g.title} aria-label={g.title} className="flex flex-col gap-3">
              <h2 className="text-small font-semibold uppercase tracking-wide text-muted">{g.title}</h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {g.items.map((w) => (
                  <WaveCard key={w.id} wave={w} perms={perms} onEdit={() => setForm(w)} onClose={() => setClosing(w)} onRevisit={() => setRevisit(w)} onDelete={() => remove(w)} />
                ))}
              </ul>
            </section>
          ),
        )
      )}
      {form && (
        <WaveForm
          wave={form === "new" ? null : form}
          regions={regions}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
      {closing && (
        <CloseModal
          wave={closing}
          onClose={() => setClosing(null)}
          onDone={() => {
            setClosing(null);
            load();
          }}
        />
      )}
      {revisit && <RevisitModal wave={revisit} onClose={() => setRevisit(null)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control bg-field px-3 py-2">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="font-mono text-title font-semibold">{value}</dd>
    </div>
  );
}

function WaveCard({ wave: w, perms, onEdit, onClose, onRevisit, onDelete }: { wave: Wave; perms: string[]; onEdit: () => void; onClose: () => void; onRevisit: () => void; onDelete: () => void }) {
  const pct = progress(w.stats);
  const closed = w.phase === "closed";
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{w.name}</p>
          <p className="text-small text-muted">
            {w.region?.name ?? "Région supprimée"} · {formatPeriod(w.startsOn, w.endsOn)}
          </p>
        </div>
        <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-small font-medium">
          <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${PHASE_TOKEN[w.phase]})` }} />
          {PHASE_LABEL[w.phase]}
        </span>
        {!closed && perms.includes("wave:update") && (
          <button type="button" aria-label={`Modifier ${w.name}`} onClick={onEdit} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
            <PencilIcon size={15} />
          </button>
        )}
        {perms.includes("wave:delete") && (
          <button type="button" aria-label={`Supprimer ${w.name}`} onClick={onDelete} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
            <TrashIcon size={15} />
          </button>
        )}
      </div>
      {pct !== null && (
        <div>
          <div className="mb-1 flex justify-between text-small">
            <span>Objectif : {w.stats.visited} / {w.stats.targetVisits} visites</span>
            <span className="font-mono">{pct} %</span>
          </div>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Avancement de ${w.name}`} className="h-2 overflow-hidden rounded-full bg-field">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `var(${PHASE_TOKEN[w.phase]})` }} />
          </div>
        </div>
      )}
      <dl className="grid grid-cols-4 gap-2">
        <Stat label="Leads" value={w.stats.total} />
        <Stat label="Visités" value={w.stats.visited} />
        <Stat label="Convertis" value={w.stats.converted} />
        <Stat label="À repasser" value={w.stats.toRevisit} />
      </dl>
      <div className="flex flex-wrap gap-2">
        {w.stats.toRevisit > 0 && (
          <Button variant="secondary" className="h-9 w-auto" onClick={onRevisit}>
            Voir les leads à repasser
          </Button>
        )}
        {!closed && perms.includes("wave:update") && (
          <Button className="h-9 w-auto" onClick={onClose}>
            Clôturer la vague
          </Button>
        )}
        {closed && w.closedAt && <p className="self-center text-small text-muted">Clôturée le {new Date(w.closedAt).toLocaleDateString("fr-FR")} : bilan figé.</p>}
      </div>
    </li>
  );
}

function WaveForm({ wave, regions, onClose, onSaved }: { wave: Wave | null; regions: Region[]; onClose: () => void; onSaved: () => void }) {
  const { companyId } = useSession();
  const [regionId, setRegionId] = useState(wave?.regionId ?? regions[0]?.id ?? "");
  const [name, setName] = useState(wave?.name ?? "");
  const [startsOn, setStartsOn] = useState(wave?.startsOn ?? today());
  const [endsOn, setEndsOn] = useState(wave?.endsOn ?? addDays(today(), 6));
  const [target, setTarget] = useState(String(wave?.targetVisits ?? 20));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const targetVisits = Math.floor(Number(target));
    if (!name.trim()) return setError("Donnez un nom à la vague.");
    if (endsOn < startsOn) return setError("La fin ne peut pas précéder le début.");
    if (!(targetVisits >= 0)) return setError("L’objectif doit être un nombre de visites (0 ou plus).");
    setBusy(true);
    try {
      const body = { name: name.trim(), startsOn, endsOn, targetVisits };
      if (wave) await api(`/waves/${wave.id}`, { method: "PATCH", body, companyId });
      else await api("/waves", { body: { ...body, regionId }, companyId });
      onSaved();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={wave ? "Modifier la vague" : "Nouvelle vague"} description="Une région, une période et un objectif de visites." onClose={onClose} width="max-w-[480px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {!wave && <Select label="Région" value={regionId} onChange={(e) => setRegionId(e.target.value)} options={regions.map((r) => ({ value: r.id, label: r.name }))} />}
        <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Semaine 48 · Cotonou centre" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          <Field label="Fin" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
        <Field label="Objectif de visites" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
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

function CloseModal({ wave, onClose, onDone }: { wave: Wave; onClose: () => void; onDone: () => void }) {
  const { companyId } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = wave.stats;
  const confirm = async () => {
    setBusy(true);
    try {
      await api(`/waves/${wave.id}/close`, { companyId, body: {} });
      onDone();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };
  return (
    <Modal title={`Clôturer « ${wave.name} » ?`} description="Le bilan sera figé tel qu’il est aujourd’hui ; la vague ne pourra plus être modifiée." onClose={onClose} width="max-w-[480px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="Visités" value={s.visited} />
          <Stat label="Convertis" value={s.converted} />
          <Stat label="À repasser" value={s.toRevisit} />
        </dl>
        <p className="text-small text-muted">
          Sur {s.total} lead{s.total > 1 ? "s" : ""} de la région{s.targetVisits > 0 ? `, pour un objectif de ${s.targetVisits} visites` : ""}.
        </p>
        <div className="flex justify-end gap-2">
          <Button className="sm:w-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="secondary" className="sm:w-auto" loading={busy} onClick={confirm}>
            Clôturer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RevisitModal({ wave, onClose }: { wave: Wave; onClose: () => void }) {
  const { companyId } = useSession();
  const [list, setList] = useState<LeadBrief[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<LeadBrief[]>(`/waves/${wave.id}/revisit`, { companyId }).then(setList).catch((e) => setError(describeError(e)));
  }, [wave.id, companyId]);
  return (
    <Modal title={`À repasser · ${wave.name}`} description="Encore ouverts et non visités pendant la période." onClose={onClose} width="max-w-[480px]">
      <div className="flex flex-col gap-3 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {list === null ? (
          <p className="text-small text-muted">Chargement…</p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
            {list.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 border-b border-rule py-2 last:border-b-0">
                <Link href={ROUTES.lead(l.id)} className="min-w-0 truncate font-medium text-link underline decoration-dotted underline-offset-4">
                  {l.name}
                </Link>
                <span className="shrink-0 text-small text-muted">{[l.city, l.phone].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

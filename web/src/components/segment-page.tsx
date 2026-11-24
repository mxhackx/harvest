"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, describeError, downloadLeads } from "@/lib/api";
import { useCrumb } from "@/lib/crumb";
import { applyLeadView, describeFilters } from "@/lib/lead-filters";
import { useLeads } from "@/lib/leads";
import { ROUTES } from "@/lib/routes";
import { sanitizeSegment, type Segment, type SegmentConfig } from "@/lib/segments";
import { useSession } from "@/lib/session";
import { stageOf } from "@/lib/stages";
import { useStages } from "@/lib/stages-store";
import { PencilIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice, Select } from "./ui";

type Tab = "overview" | "settings";

/**
 * Page d'un segment : son nom, son type (dynamique : il suit vos leads), sa taille et la part de la base qu'il représente,
 * ses critères à gauche, ses leads à droite avec recherche et export. L'onglet Réglages renomme, décrit et supprime.
 */
export function SegmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, companyId } = useSession();
  const { leads } = useLeads();
  const { stages } = useStages();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  useCrumb(segment?.name);

  useEffect(() => {
    api<Segment>(`/segments/${id}`, { companyId })
      .then(setSegment)
      .catch((e) => setError(describeError(e)));
  }, [id, companyId]);

  const config = useMemo(() => (segment ? sanitizeSegment(segment.config) : null), [segment]);
  const members = useMemo(() => (leads && config ? applyLeadView(leads, config, me.user.id) : []), [leads, config, me.user.id]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? members.filter((l) => `${l.name} ${l.sector} ${l.city} ${l.contactName}`.toLowerCase().includes(q)) : members;
  }, [members, search]);

  if (!segment || !config) return error ? <Notice onClose={() => setError(null)}>{error}</Notice> : <p className="text-small text-muted">Chargement…</p>;

  const total = leads?.length ?? 0;
  const share = total ? Math.round((members.length / total) * 100) : 0;
  const criteria = describeFilters(config);
  const save = async (body: Partial<{ name: string; description: string; config: SegmentConfig }>) => {
    try {
      setSegment(await api<Segment>(`/segments/${segment.id}`, { method: "PATCH", body, companyId }));
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  };
  const remove = async () => {
    if (!window.confirm(`Supprimer le segment « ${segment.name} » ? Les leads ne sont pas touchés.`)) return;
    await api(`/segments/${segment.id}`, { method: "DELETE", companyId }).catch((e) => setError(describeError(e)));
    router.replace(ROUTES.segments);
  };
  const exportIt = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      await downloadLeads({ format, ids: members.map((l) => l.id), companyId });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={ROUTES.segments} className="text-small font-medium text-link hover:underline">‹ Retour aux segments</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-title font-semibold">{segment.name}</h1>
          <span className="rounded-md border border-border px-2 text-small font-medium">Leads</span>
          <span className="rounded-md border border-border px-2 text-small font-medium">Dynamique</span>
          <span className="rounded-md border border-border px-2 text-small font-medium">Taille : {members.length}</span>
        </div>
        {segment.description && <p className="mt-1 text-small text-muted">{segment.description}</p>}
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <div role="tablist" aria-label="Segment" className="flex gap-1 border-b border-rule">
        {([["overview", "Aperçu"], ["settings", "Réglages"]] as const).map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)} className={`h-9 border-b-2 px-3 text-body font-medium ${tab === key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <SettingsPanel segment={segment} onSave={save} onDelete={remove} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section aria-label="Filtres" className="rounded-card border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-body font-semibold">Filtres</h2>
              <Button variant="secondary" className="h-8 w-auto" onClick={() => setFiltersOpen(true)}>
                <PencilIcon size={14} /> Modifier
              </Button>
            </div>
            {criteria.length === 0 ? (
              <p className="text-small text-muted">Ce segment n’a aucun filtre : il contient tous vos leads.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {criteria.map((c) => (
                  <li key={c} className="rounded-control bg-field px-3 py-2 text-small">{c}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-card p-4">
            <dl aria-label="Résumé du segment" className="grid grid-cols-2 gap-3 rounded-card border border-border p-3 md:grid-cols-4">
              {[
                ["Taille", String(members.length)],
                ["% de la base", `${share} %`],
                ["Créé le", new Date(segment.createdAt).toLocaleDateString("fr-FR")],
                ["Type", "Dynamique"],
              ].map(([label, value]) => (
                <div key={label} className="text-center">
                  <dt className="text-small uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="font-mono text-title font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              <input type="search" aria-label="Rechercher dans le segment" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher dans le segment" className="h-9 min-w-0 flex-1 rounded-full border border-border bg-field px-4 text-small" />
              <Button variant="secondary" className="h-9 w-auto" loading={exporting} disabled={members.length === 0} onClick={() => exportIt("csv")}>
                Exporter (CSV)
              </Button>
              <Button variant="secondary" className="h-9 w-auto" loading={exporting} disabled={members.length === 0} onClick={() => exportIt("json")}>
                Exporter (JSON)
              </Button>
            </div>

            {leads === null ? (
              <p className="text-small text-muted">Chargement…</p>
            ) : shown.length === 0 ? (
              <div className="rounded-card border border-border px-6 py-12 text-center">
                <h3 className="font-display text-title font-semibold">{members.length === 0 ? "Ce segment est vide pour l’instant." : "Aucun résultat."}</h3>
                <p className="mx-auto mt-1 max-w-[420px] text-small text-muted">{members.length === 0 ? "Aucun lead ne correspond à ses filtres. Il se remplira dès qu’un lead y correspondra." : "Essayez un autre mot."}</p>
              </div>
            ) : (
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-rule text-left text-small text-muted">
                    <th className="px-2 py-2 font-medium">Lead</th>
                    <th className="px-2 py-2 font-medium">Étape</th>
                    <th className="px-2 py-2 font-medium">Ville</th>
                    <th className="px-2 py-2 text-right font-medium">Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {shown.slice(0, 200).map((l) => {
                    const st = stageOf(stages, l.status);
                    return (
                      <tr key={l.id} className="hover:bg-field">
                        <td className="px-2 py-2"><Link href={ROUTES.lead(l.id)} className="font-medium text-link hover:underline">{l.name}</Link></td>
                        <td className="px-2 py-2 text-small"><span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: st.color }} />{st.name}</span></td>
                        <td className="px-2 py-2 text-small text-muted">{l.city || "—"}</td>
                        <td className="px-2 py-2 text-right font-mono text-small">{l.estimatedValue !== null ? l.estimatedValue.toLocaleString("fr-FR") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {shown.length > 200 && <p className="text-small text-muted">200 premiers leads sur {shown.length} : exportez le segment pour tous les avoir.</p>}
          </section>
        </div>
      )}

      {filtersOpen && <FiltersModal config={config} leads={leads ?? []} onClose={() => setFiltersOpen(false)} onSave={async (c) => { await save({ config: c }); setFiltersOpen(false); }} />}
    </div>
  );
}

function SettingsPanel({ segment, onSave, onDelete }: { segment: Segment; onSave: (b: { name?: string; description?: string }) => Promise<void>; onDelete: () => void }) {
  const [name, setName] = useState(segment.name);
  const [description, setDescription] = useState(segment.description);
  const [busy, setBusy] = useState(false);
  return (
    <section aria-label="Réglages du segment" className="flex max-w-[520px] flex-col gap-4 rounded-card border border-border bg-card p-4">
      <Field label="Nom du segment" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <Field label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
      <div className="flex flex-wrap gap-2">
        <Button className="h-9 w-auto" loading={busy} disabled={!name.trim()} onClick={async () => { setBusy(true); await onSave({ name: name.trim(), description: description.trim() }); setBusy(false); }}>
          Enregistrer
        </Button>
        <Button variant="secondary" className="h-9 w-auto" onClick={onDelete}>
          <TrashIcon size={14} /> Supprimer le segment
        </Button>
      </div>
    </section>
  );
}

function FiltersModal({ config, leads, onClose, onSave }: { config: SegmentConfig; leads: { sector: string }[]; onClose: () => void; onSave: (c: SegmentConfig) => Promise<void> }) {
  const [c, setC] = useState<SegmentConfig>(config);
  const [busy, setBusy] = useState(false);
  const sectors = [...new Set(leads.map((l) => l.sector).filter(Boolean))].sort();
  const f = (k: keyof SegmentConfig["filters"]) => (e: { target: { value: string } }) => setC((s) => ({ ...s, filters: { ...s.filters, [k]: e.target.value } as SegmentConfig["filters"] }));
  return (
    <Modal title="Modifier les filtres" description="Le segment se met à jour tout de suite." onClose={onClose} width="max-w-[460px]">
      <div className="flex flex-col gap-4 p-[18px]">
        <Select label="Leads" value={c.tab} onChange={(e) => setC((s) => ({ ...s, tab: e.target.value as SegmentConfig["tab"] }))} options={[{ value: "all", label: "Tous les leads" }, { value: "mine", label: "Mes leads" }]} />
        <Select label="Type de prospect" value={c.filters.mode} onChange={f("mode")} options={[{ value: "all", label: "Tous" }, { value: "onsite", label: "À visiter en présentiel" }, { value: "remote", label: "Simples (à distance)" }]} />
        <Select label="Visite" value={c.filters.visit} onChange={f("visit")} options={[{ value: "all", label: "Toutes" }, { value: "to_visit", label: "Pas encore visités" }, { value: "visited", label: "Déjà visités" }]} />
        <Select label="Position" value={c.filters.position} onChange={f("position")} options={[{ value: "all", label: "Toutes" }, { value: "with", label: "Avec une position" }, { value: "without", label: "Sans position" }]} />
        <Select label="Secteur" value={c.filters.sector} onChange={f("sector")} options={[{ value: "all", label: "Tous" }, ...sectors.map((s) => ({ value: s, label: s }))]} />
        <Field label="Le nom, le secteur ou l’adresse contient" value={c.query} onChange={(e) => setC((s) => ({ ...s, query: e.target.value }))} maxLength={100} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>Annuler</Button>
          <Button className="sm:w-auto" loading={busy} onClick={async () => { setBusy(true); await onSave(c); }}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  );
}

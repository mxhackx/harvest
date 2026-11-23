"use client";

import { useMemo, useState } from "react";
import { ApiError, api, describeError, downloadLeads, errorMessage, formatValue, savedMessage, type Lead } from "@/lib/api";
import { pipelineSummary, stageOf } from "@/lib/stages";
import { useStages } from "@/lib/stages-store";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { BoardIcon, CheckIcon, ChevronIcon, DownloadIcon, FilterIcon, PlusIcon, SearchIcon, SortIcon, TableIcon, TrashIcon, UploadIcon, XIcon } from "./icons";
import { LeadBoard } from "./lead-board";
import { AddLeadChooser } from "./add-lead-chooser";
import { ImportModal } from "./import-modal";
import { AssignModal } from "./assign-modal";
import { LeadModal } from "./lead-modal";
import { LostReasonModal } from "./lost-reason-modal";
import { LeadTable } from "./lead-table";
import { Button, Menu, MenuItem, Modal, Notice, Select } from "./ui";

type Tab = "all" | "mine";
type View = "board" | "table";
type SortKey = "recent" | "name" | "value";
type Filters = { visit: "all" | "to_visit" | "visited"; position: "all" | "with" | "without"; sector: string };

const NO_FILTERS: Filters = { visit: "all", position: "all", sector: "all" };
const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Plus récents" },
  { key: "name", label: "Nom (A → Z)" },
  { key: "value", label: "Valeur décroissante" },
];

const pill = "flex h-9 items-center gap-2 rounded-full border px-3 text-small font-medium";
const ghost = "flex h-9 items-center gap-2 rounded-control px-3 text-small font-medium hover:bg-field disabled:opacity-50";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function LeadsPage() {
  const { me, companyId } = useSession();
  const { stages } = useStages();
  // déplacement vers une étape « perdu » en attente du motif
  const [lostAsk, setLostAsk] = useState<{ ids: string[]; status: string } | null>(null);
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const canRead = perms.includes("lead:read");
  const canCreate = perms.includes("lead:create");
  const canUpdate = perms.includes("lead:update");
  const canAssign = perms.includes("lead:assign") && perms.includes("member:read");
  const [assigning, setAssigning] = useState<string[] | null>(null);
  const canDelete = perms.includes("lead:delete");
  const canExport = perms.includes("lead:export");

  const { leads, setLeads, reload: load, error: loadError, clearError } = useLeads();
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // fiche ouverte : un lead à modifier, "new" pour une création, null si fermée
  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const [chooser, setChooser] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const sectors = useMemo(() => [...new Set((leads ?? []).map((l) => l.sector).filter(Boolean))].sort(), [leads]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (leads ?? []).filter((l) => {
      if (tab === "mine" && l.ownerId !== me.user.id) return false;
      if (filters.visit === "visited" && !l.visitedAt) return false;
      if (filters.visit === "to_visit" && l.visitedAt) return false;
      const located = l.lat !== null && l.lng !== null;
      if (filters.position === "with" && !located) return false;
      if (filters.position === "without" && located) return false;
      if (filters.sector !== "all" && l.sector !== filters.sector) return false;
      if (q && ![l.name, l.sector, l.address, l.contactName, l.phone].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "fr")
        : sort === "value"
          ? (b.estimatedValue ?? -1) - (a.estimatedValue ?? -1)
          : b.createdAt.localeCompare(a.createdAt),
    );
  }, [leads, tab, filters, query, sort, me.user.id]);

  // La sélection ne garde que ce qui est visible : on n'agit jamais sur un lead qu'on ne voit pas.
  const sel = useMemo(() => {
    const visible = new Set(shown.map((l) => l.id));
    return new Set([...selected].filter((id) => visible.has(id)));
  }, [selected, shown]);

  const activeFilters = (filters.visit !== "all" ? 1 : 0) + (filters.position !== "all" ? 1 : 0) + (filters.sector !== "all" ? 1 : 0);
  const mineCount = (leads ?? []).filter((l) => l.ownerId === me.user.id).length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(sel.size === shown.length ? new Set() : new Set(shown.map((l) => l.id)));

  const summary = (r: { affected: number; skipped: number }, done: string) =>
    `${plural(r.affected, "lead", "leads")} ${done}` +
    (r.skipped > 0 ? ` · ${r.skipped} ignoré${r.skipped > 1 ? "s" : ""} (hors de vos droits)` : "");

  async function bulkUpdate(ids: string[], patch: { status?: string; lostReason?: string; visited?: boolean }) {
    setBusy(true);
    try {
      const r = await api<{ affected: number; skipped: number }>("/leads/bulk-update", { companyId, body: { ids, ...patch } });
      setSelected(new Set());
      setNotice(summary(r, "mis à jour"));
    } catch (e) {
      setNotice(errorMessage(e instanceof ApiError ? e.code : null));
    } finally {
      await load(); // dans tous les cas on reprend l'état réel du serveur
      setBusy(false);
    }
  }

  function move(ids: string[], status: string, lostReason?: string) {
    // Affichage immédiat ; le rechargement qui suit corrige si le serveur a refusé.
    setLeads((prev) => prev && prev.map((l) => (ids.includes(l.id) ? { ...l, status, ...(lostReason !== undefined ? { lostReason } : {}) } : l)));
    bulkUpdate(ids, { status, ...(lostReason !== undefined ? { lostReason } : {}) });
  }

  /** Vers une étape « perdu » on demande d'abord le motif ; sinon le déplacement est immédiat. */
  function requestMove(ids: string[], status: string) {
    if (stageOf(stages, status).kind === "lost") setLostAsk({ ids, status });
    else move(ids, status);
  }

  async function bulkDelete() {
    setBusy(true);
    try {
      const r = await api<{ affected: number; skipped: number }>("/leads/bulk-delete", {
        companyId,
        body: { ids: [...sel] },
      });
      setSelected(new Set());
      setNotice(summary(r, r.affected > 1 ? "supprimés" : "supprimé"));
    } catch (e) {
      setNotice(errorMessage(e instanceof ApiError ? e.code : null));
    } finally {
      setConfirmDelete(false);
      await load();
      setBusy(false);
    }
  }


  async function exportLeads(format: "csv" | "json", delimiter: "," | ";", ids: string[]) {
    setBusy(true);
    try {
      await downloadLeads({ format, delimiter, ids, companyId });
      setNotice(`Export ${format.toUpperCase()} téléchargé (${plural(ids.length, "lead", "leads")}).`);
    } catch (e) {
      setNotice(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const exportMenu = (ids: string[], label: string, align: "left" | "right", trigger: (t: { toggle: () => void; open: boolean }) => React.ReactNode) => (
    <Menu align={align} trigger={trigger}>
      {(close) => (
        <>
          <p className="px-3 py-2 text-small text-muted">{label}</p>
          {(
            [
              ["CSV", "csv", ","],
              ["CSV pour Excel français (;)", "csv", ";"],
              ["JSON", "json", ","],
            ] as const
          ).map(([text, format, delimiter]) => (
            <MenuItem
              key={text}
              onClick={() => {
                close();
                exportLeads(format, delimiter, ids);
              }}
            >
              {text}
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  );

  const tabClass = (active: boolean) =>
    `-mb-px h-10 border-b-2 px-1 text-body ${active ? "border-accent font-semibold" : "border-transparent text-muted hover:text-ink"}`;

  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-border bg-card p-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-title font-semibold">Leads</h1>
        {canCreate && (
          <Button onClick={() => setChooser(true)} className="h-9 w-auto">
            <PlusIcon size={16} />
            Ajouter un lead
          </Button>
        )}
      </header>

      <div role="tablist" className="flex gap-6 border-b border-rule">
        <button role="tab" aria-selected={tab === "all"} className={tabClass(tab === "all")} onClick={() => setTab("all")}>
          Tous les leads <span className="font-mono text-small text-muted">{leads?.length ?? "–"}</span>
        </button>
        <button role="tab" aria-selected={tab === "mine"} className={tabClass(tab === "mine")} onClick={() => setTab("mine")}>
          Mes leads <span className="font-mono text-small text-muted">{leads ? mineCount : "–"}</span>
        </button>
      </div>

      {canRead && leads && leads.length > 0 && <PipelineBar leads={shown} />}

      {(notice || loadError) && <Notice onClose={() => (notice ? setNotice(null) : clearError())}>{notice ?? loadError}</Notice>}

      {sel.size > 0 ? (
        /* Barre d'actions de masse : remplace la barre d'outils tant qu'une sélection existe */
        <div className="flex min-h-12 flex-wrap items-center gap-1 rounded-control border border-border px-3 py-1.5">
          <span className="mr-2 text-small font-medium">
            {sel.size} {sel.size > 1 ? "sélectionnés" : "sélectionné"}
          </span>
          {canUpdate && (
            <>
              <Menu
                trigger={({ toggle }) => (
                  <button type="button" onClick={toggle} disabled={busy} className={ghost}>
                    Changer l&apos;étape <ChevronIcon size={14} />
                  </button>
                )}
              >
                {(close) =>
                  stages.map((st) => (
                    <MenuItem
                      key={st.key}
                      onClick={() => {
                        close();
                        requestMove([...sel], st.key);
                      }}
                    >
                      <span aria-hidden className="size-2.5 rounded-full border border-black/15" style={{ background: st.color }} />
                      {st.name}
                    </MenuItem>
                  ))
                }
              </Menu>
              <Menu
                trigger={({ toggle }) => (
                  <button type="button" onClick={toggle} disabled={busy} className={ghost}>
                    Visite <ChevronIcon size={14} />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <MenuItem onClick={() => { close(); bulkUpdate([...sel], { visited: true }); }}>Marquer visités</MenuItem>
                    <MenuItem onClick={() => { close(); bulkUpdate([...sel], { visited: false }); }}>Remettre à visiter</MenuItem>
                  </>
                )}
              </Menu>
            </>
          )}
          {canAssign && (
            <button type="button" onClick={() => setAssigning([...sel])} disabled={busy} className={ghost}>
              Attribuer à…
            </button>
          )}
          {canExport &&
            exportMenu([...sel], `${plural(sel.size, "lead sélectionné", "leads sélectionnés")}`, "left", ({ toggle }) => (
              <button type="button" onClick={toggle} disabled={busy} className={ghost}>
                <DownloadIcon size={16} /> Exporter <ChevronIcon size={14} />
              </button>
            ))}
          {canDelete && (
            <>
              {/* l'action destructive reste à l'écart des actions fréquentes */}
              <span aria-hidden className="mx-2 h-5 w-px bg-rule" />
              <button type="button" disabled={busy} className={ghost} onClick={() => setConfirmDelete(true)}>
                <TrashIcon size={16} /> Supprimer
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Désélectionner"
            className="ml-auto flex size-9 items-center justify-center rounded-full text-muted hover:bg-field"
          >
            <XIcon size={18} />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Rechercher un lead</span>
            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <SearchIcon size={16} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un lead"
              className="h-9 w-full rounded-full border border-frame bg-field pl-9 pr-3 text-small placeholder:text-muted focus:border-ink"
            />
          </label>

          <Menu
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className={`${pill} ${activeFilters ? "border-accent bg-accent-soft" : "border-frame hover:bg-field"}`}
              >
                <FilterIcon size={16} /> Filtrer
                {activeFilters > 0 && <span className="font-mono">{activeFilters}</span>}
              </button>
            )}
          >
            {() => (
              <div className="flex w-72 flex-col gap-3 p-2">
                <Select
                  label="Visite"
                  value={filters.visit}
                  onChange={(e) => setFilters((f) => ({ ...f, visit: e.target.value as Filters["visit"] }))}
                  options={[
                    { value: "all", label: "Toutes" },
                    { value: "to_visit", label: "À visiter" },
                    { value: "visited", label: "Visités" },
                  ]}
                />
                <Select
                  label="Position"
                  value={filters.position}
                  onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value as Filters["position"] }))}
                  options={[
                    { value: "all", label: "Toutes" },
                    { value: "with", label: "Avec position" },
                    { value: "without", label: "Sans position" },
                  ]}
                />
                <Select
                  label="Secteur"
                  value={filters.sector}
                  onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
                  options={[{ value: "all", label: "Tous" }, ...sectors.map((s) => ({ value: s, label: s }))]}
                />
                {activeFilters > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters(NO_FILTERS)}
                    className="self-start text-small font-medium text-link underline decoration-dotted decoration-2 underline-offset-4"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )}
          </Menu>

          <Menu
            trigger={({ toggle, open }) => (
              <button type="button" onClick={toggle} aria-expanded={open} className={`${pill} border-frame hover:bg-field`}>
                <SortIcon size={16} /> {SORTS.find((s) => s.key === sort)!.label}
              </button>
            )}
          >
            {(close) =>
              SORTS.map((s) => (
                <MenuItem
                  key={s.key}
                  active={sort === s.key}
                  onClick={() => {
                    setSort(s.key);
                    close();
                  }}
                >
                  <span className="flex size-4 items-center">{sort === s.key && <CheckIcon size={16} />}</span>
                  {s.label}
                </MenuItem>
              ))
            }
          </Menu>

          <div className="ml-auto flex items-center gap-2">
            {canCreate && (
              <button type="button" onClick={() => setImporting(true)} className={`${pill} border-frame hover:bg-field`}>
                <UploadIcon size={16} /> Importer
              </button>
            )}
            {canExport &&
              exportMenu(shown.map((l) => l.id), `${plural(shown.length, "lead affiché", "leads affichés")}`, "right", ({ toggle, open }) => (
                <button type="button" onClick={toggle} aria-expanded={open} disabled={busy || shown.length === 0} className={`${pill} border-frame hover:bg-field disabled:opacity-50`}>
                  <DownloadIcon size={16} /> Exporter
                </button>
              ))}
            <div className="flex gap-1">
            {(
              [
                ["board", "Vue board", BoardIcon],
                ["table", "Vue tableau", TableIcon],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={`flex size-9 items-center justify-center rounded-full border ${
                  view === key ? "border-accent bg-accent-soft text-accent-press" : "border-frame hover:bg-field"
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      {!canRead ? (
        <p className="text-small text-muted">Vous n&apos;avez pas accès à la liste des leads.</p>
      ) : leads === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : view === "board" ? (
        <LeadBoard leads={shown} selected={sel} canMove={canUpdate && !busy} onToggle={toggle} onOpen={setEditing} onMove={requestMove} />
      ) : (
        <LeadTable leads={shown} selected={sel} onToggle={toggle} onToggleAll={toggleAll} onOpen={setEditing} />
      )}

      {chooser && (
        <AddLeadChooser
          onClose={() => setChooser(false)}
          onManual={() => {
            setChooser(false);
            setEditing("new");
          }}
          onFile={() => {
            setChooser(false);
            setImporting(true);
          }}
        />
      )}

      {editing && (
        <LeadModal
          lead={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, mode) => {
            setEditing(null);
            setNotice(savedMessage(saved, mode));
            load();
          }}
          onDeleted={(gone) => {
            setEditing(null);
            setNotice(`« ${gone.name} » supprimé.`);
            load();
          }}
        />
      )}

      {assigning && (
        <AssignModal
          ids={assigning}
          onClose={() => setAssigning(null)}
          onDone={(n) => {
            setAssigning(null);
            setSelected(new Set());
            setNotice(n === 0 ? "Aucun lead déplacé (déjà à cette personne, ou hors de vos droits)." : `${plural(n, "lead attribué", "leads attribués")}.`);
            load();
          }}
        />
      )}

      {lostAsk && (
        <LostReasonModal
          count={lostAsk.ids.length}
          stageName={stageOf(stages, lostAsk.status).name}
          onClose={() => setLostAsk(null)}
          onConfirm={(reason) => {
            move(lostAsk.ids, lostAsk.status, reason);
            setLostAsk(null);
          }}
        />
      )}

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={(r) => {
            setImporting(false);
            setNotice(
              `${plural(r.imported, "lead importé", "leads importés")}` +
                (r.duplicates ? ` · ${plural(r.duplicates, "doublon ignoré", "doublons ignorés")}` : "") +
                (r.invalid ? ` · ${plural(r.invalid, "ligne invalide ignorée", "lignes invalides ignorées")}` : "") +
                (r.locating ? ` · recherche de position en cours pour ${r.locating} : ils apparaîtront sur la carte dans quelques instants.` : "."),
            );
            load();
            // la localisation des adresses se fait en arrière-plan : on revient voir le résultat
            if (r.locating) {
              setTimeout(load, 8000);
              setTimeout(load, 25000);
            }
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title={`Supprimer ${plural(sel.size, "lead", "leads")} ?`}
          description="Cette action est définitive."
          onClose={() => setConfirmDelete(false)}
          width="max-w-[440px]"
        >
          <div className="flex justify-end gap-2">
            {/* Annuler porte l'accent : le choix sûr est le plus accessible */}
            <Button onClick={() => setConfirmDelete(false)} className="sm:w-auto">
              Annuler
            </Button>
            <Button variant="secondary" onClick={bulkDelete} loading={busy} className="sm:w-auto">
              Supprimer définitivement
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

/** Valeur du pipeline en un coup d'œil : ce qui est en cours (et pondéré par la chance de conclure), gagné, perdu. */
function PipelineBar({ leads }: { leads: Lead[] }) {
  const { stages } = useStages();
  const s = pipelineSummary(leads, stages);
  const tile = (label: string, value: number, sub: string) => (
    <div className="rounded-control bg-field px-3 py-2">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="font-mono text-title font-semibold">{formatValue(value)}</dd>
      <dd className="text-small text-muted">{sub}</dd>
    </div>
  );
  return (
    <dl aria-label="Valeur du pipeline" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tile("En cours", s.open.value, plural(s.open.count, "lead", "leads"))}
      {tile("Pondéré", s.open.weighted, "selon l'étape")}
      {tile("Gagné", s.won.value, plural(s.won.count, "lead", "leads"))}
      {tile("Perdu", s.lost.value, plural(s.lost.count, "lead", "leads"))}
    </dl>
  );
}

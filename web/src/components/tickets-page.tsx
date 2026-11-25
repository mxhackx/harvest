"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { useLeads } from "@/lib/leads";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { PRIORITY_LABEL, PRIORITY_TOKEN, STATUS_LABEL, STATUS_TOKEN, type Ticket, type TicketPriority } from "@/lib/support";
import { PlusIcon } from "./icons";
import { Button, Field, Modal, Notice, Select, TextArea } from "./ui";

type Filter = "active" | "resolved" | "closed" | "all";
const FILTERS: [Filter, string][] = [["active", "À traiter"], ["resolved", "Résolus"], ["closed", "Fermés"], ["all", "Tous"]];

/** Tickets : les demandes et réclamations des clients après la vente. */
export function TicketsPage() {
  const { me, companyId } = useSession();
  const canCreate = me.memberships[0].permissions.some((p) => p.permission === "ticket:create");
  const [filter, setFilter] = useState<Filter>("active");
  const [mine, setMine] = useState(false);
  const [list, setList] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    () =>
      api<Ticket[]>(`/tickets?${filter === "all" ? "" : `status=${filter}`}${mine ? "&mine=1" : ""}`, { companyId })
        .then(setList)
        .catch((e) => setError(describeError(e))),
    [companyId, filter, mine],
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Tickets</h1>
          <p className="text-small text-muted">Les demandes et réclamations de vos clients après la vente, de l’ouverture à la résolution.</p>
        </div>
        {canCreate && (
          <Button className="h-9 w-auto" onClick={() => setCreating(true)}>
            <PlusIcon size={16} /> Nouveau ticket
          </Button>
        )}
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Filtre" className="flex gap-1">
          {FILTERS.map(([key, label]) => (
            <button key={key} role="tab" type="button" aria-selected={filter === key} onClick={() => setFilter(key)} className={`h-8 rounded-full border px-3 text-small font-medium ${filter === key ? "border-accent bg-accent-soft" : "border-frame hover:bg-field"}`}>
              {label}
            </button>
          ))}
        </div>
        <label className="ml-2 flex items-center gap-2 text-small">
          <input type="checkbox" className="size-4 accent-accent" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          Seulement les miens
        </label>
      </div>
      <section className="overflow-hidden rounded-card border border-border bg-card">
        {list === null ? (
          <p className="px-[18px] py-4 text-small text-muted">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="px-[18px] py-10 text-center text-small text-muted">Aucun ticket ici.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {list.map((t) => (
              <li key={t.id}>
                <Link href={ROUTES.ticket(t.id)} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-field">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{t.title}</span>
                    <span className="block text-small text-muted">{[t.leadName, t.assigneeName ? `confié à ${t.assigneeName}` : "non attribué", new Date(t.createdAt).toLocaleDateString("fr-FR")].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md border border-border px-2 text-small font-medium">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${PRIORITY_TOKEN[t.priority]})` }} />
                    {PRIORITY_LABEL[t.priority]}
                  </span>
                  <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md border border-border px-2 text-small font-medium">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${STATUS_TOKEN[t.status]})` }} />
                    {STATUS_LABEL[t.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {creating && <CreateTicket onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function CreateTicket({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { companyId } = useSession();
  const { leads } = useLeads();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api("/tickets", { companyId, body: { title: title.trim(), description: description.trim(), leadId: leadId || null, priority } });
      onCreated();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };
  return (
    <Modal title="Nouveau ticket" onClose={onClose} width="max-w-[520px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Objet" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="Le client n’arrive pas à se connecter" />
        <Select label="Client concerné" value={leadId} onChange={(e) => setLeadId(e.target.value)} options={[{ value: "", label: "Aucun client précis" }, ...[...(leads ?? [])].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((l) => ({ value: l.id, label: l.name }))]} />
        <Select label="Priorité" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} options={(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        <TextArea label="Description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>Annuler</Button>
          <Button className="sm:w-auto" loading={busy} disabled={!title.trim()} onClick={save}>Créer</Button>
        </div>
      </div>
    </Modal>
  );
}

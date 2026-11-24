"use client";

import { ROUTES } from "@/lib/routes";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, describeError } from "@/lib/api";
import type { Contact } from "@/lib/activity";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { SearchIcon } from "./icons";
import { ContactForm, type ContactValues } from "./contact-form";
import { SendMessageModal } from "./send-message-modal";
import { Button, Notice } from "./ui";

type Row = Contact & { leadName: string; accountId: string | null; accountName: string | null; ownerName: string | null };
type Page = { items: Row[]; total: number };
type SortKey = "name" | "account" | "role";
const PAGE = 50;

/**
 * Contacts, comme une vue de liste de CRM : « Tous les contacts », colonnes Nom complet / Compte / Fonction /
 * Téléphone / E-mail / Propriétaire, recherche dans la liste, tri, et « Nouveau ». Un clic ouvre le lead.
 */
export function ContactsPage() {
  const { me, companyId } = useSession();
  const { leads } = useLeads();
  const canWrite = me.memberships[0].permissions.some((p) => p.permission === "lead:update");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<Row | null>(null);
  const [more, setMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [version, setVersion] = useState(0);

  // recherche différée : on n'interroge pas l'API à chaque frappe
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    let live = true;
    api<Page>(`/contacts?limit=${PAGE}&q=${encodeURIComponent(q)}`, { companyId })
      .then((p) => live && (setRows(p.items), setTotal(p.total), setError(null)))
      .catch((e) => live && setError(describeError(e)));
    return () => {
      live = false;
    };
  }, [q, companyId, version]);

  async function loadMore() {
    if (!rows) return;
    setMore(true);
    try {
      const p = await api<Page>(`/contacts?limit=${PAGE}&offset=${rows.length}&q=${encodeURIComponent(q)}`, { companyId });
      setRows((cur) => [...(cur ?? []), ...p.items]);
      setTotal(p.total);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setMore(false);
    }
  }

  const label = (c: Row) => c.name;
  const sorted = useMemo(() => {
    const key = (c: Row) => (sort === "account" ? (c.accountName ?? c.leadName) : sort === "role" ? c.role : label(c));
    return [...(rows ?? [])].sort((a, b) => key(a).localeCompare(key(b), "fr"));
  }, [rows, sort]);
  const th = (k: SortKey, text: string) => (
    <th className="px-3 py-2" aria-sort={sort === k ? "ascending" : "none"}>
      <button type="button" onClick={() => setSort(k)} className={`font-medium hover:text-ink ${sort === k ? "text-ink" : ""}`}>
        {text} {sort === k && <span aria-hidden>↑</span>}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-small text-muted">Contacts</p>
          <h1 className="font-display text-title font-semibold">Tous les contacts</h1>
          <p className="mt-1 text-small text-muted">
            {rows === null ? "…" : `${total} élément${total > 1 ? "s" : ""}`} · trié(s) par {sort === "name" ? "nom complet" : sort === "account" ? "compte" : "fonction"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block w-full sm:w-[280px]">
            <span className="sr-only">Rechercher un contact</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><SearchIcon size={16} /></span>
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Recherchez dans cette liste…"
              className="h-9 w-full rounded-control border border-border bg-field pl-9 pr-3 text-small placeholder:text-muted focus:border-ink"
            />
          </label>
          {canWrite && (
            <Button className="h-9 w-auto" onClick={() => setCreating(true)}>
              Nouveau
            </Button>
          )}
        </div>
      </div>

      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <section className="overflow-hidden rounded-card border border-border bg-card">
        {rows === null ? (
          <p className="px-[18px] py-4 text-small text-muted">Chargement…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <h2 className="font-display text-title font-semibold">{q ? "Aucun contact ne correspond" : "Les meilleurs vendeurs ajoutent d’abord leurs contacts"}</h2>
            <p className="max-w-[420px] text-small text-muted">{q ? "Essayez un autre mot." : "Le moyen le plus rapide d’augmenter le volume d’affaires."}</p>
            {!q && canWrite && (
              <Button className="mt-2 h-10 w-auto" onClick={() => setCreating(true)}>
                Ajouter un contact
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-body">
              <thead>
                <tr className="border-b border-rule bg-field text-left text-small text-muted">
                  {th("name", "Nom complet")}
                  {th("account", "Nom du compte")}
                  {th("role", "Fonction")}
                  <th className="px-3 py-2 font-medium">Téléphone</th>
                  <th className="px-3 py-2 font-medium">Adresse e-mail</th>
                  <th className="px-3 py-2 font-medium">Propriétaire</th>
                  <th className="w-24 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {sorted.map((c) => (
                  <tr key={c.id} className="hover:bg-field">
                    <td className="px-3 py-2 font-medium">
                      {[c.salutation, c.name].filter(Boolean).join(" ")}
                      {c.isPrimary && <span className="ml-2 rounded-md bg-accent-soft px-2 py-0.5 text-small font-bold text-accent-press">Principal</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={ROUTES.lead(c.leadId)} className="text-link hover:underline">{c.accountName ?? c.leadName}</Link>
                    </td>
                    <td className="px-3 py-2 text-muted">{c.role || "—"}</td>
                    <td className="px-3 py-2 font-mono text-small">{c.whatsapp || c.phone || "—"}</td>
                    <td className="px-3 py-2 text-small">{c.email || "—"}</td>
                    <td className="px-3 py-2 text-small text-muted">{c.ownerName ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {canWrite && (c.whatsapp || c.phone || c.email) && (
                        <button type="button" onClick={() => setSending(c)} className="h-8 rounded-control border border-frame px-3 text-small font-medium hover:bg-field">
                          Message
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows && rows.length > 0 && (
          <footer className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2 text-small text-muted">
            <span>{rows.length} sur {total}</span>
            {rows.length < total && (
              <Button variant="secondary" className="h-8 w-auto" loading={more} onClick={loadMore}>Voir plus</Button>
            )}
          </footer>
        )}
      </section>

      {creating && (
        <ContactForm
          leads={[...(leads ?? [])].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((l) => ({ id: l.id, name: l.name }))}
          onClose={() => setCreating(false)}
          onSubmit={async (v: ContactValues, leadId: string) => {
            const body = { ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val.trim()])), reportsToId: null };
            await api(`/leads/${leadId}/contacts`, { method: "POST", body, companyId });
            setCreating(false);
            setVersion((x) => x + 1);
          }}
        />
      )}

      {sending && (
        <SendMessageModal
          lead={{ id: sending.leadId, name: sending.leadName }}
          recipients={[{ label: sending.name, name: sending.name, whatsapp: sending.whatsapp, phone: sending.phone, email: sending.email }]}
          onClose={() => setSending(null)}
        />
      )}
    </div>
  );
}

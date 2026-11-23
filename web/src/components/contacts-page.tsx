"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import type { Contact } from "@/lib/activity";
import { useSession } from "@/lib/session";
import { SearchIcon } from "./icons";
import { SendMessageModal } from "./send-message-modal";
import { Button, Notice } from "./ui";

type Row = Contact & { leadName: string };
type Page = { items: Row[]; total: number };
const PAGE = 50;

/** Toutes les personnes de tous les leads visibles, avec recherche ; un clic ouvre le lead ou prépare un message. */
export function ContactsPage() {
  const { me, companyId } = useSession();
  const canWrite = me.memberships[0].permissions.some((p) => p.permission === "lead:update");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<Row | null>(null);
  const [more, setMore] = useState(false);

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
  }, [q, companyId]);

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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold">Contacts</h1>
          <p className="text-small text-muted">Les personnes à joindre dans vos leads. On les ajoute depuis la fiche d’un lead.</p>
        </div>
        <label className="relative block w-full sm:w-[320px]">
          <span className="sr-only">Rechercher un contact</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><SearchIcon size={16} /></span>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nom, fonction, téléphone, lead…"
            className="h-10 w-full rounded-control border border-border bg-field pl-9 pr-3 text-body placeholder:text-muted focus:border-ink"
          />
        </label>
      </div>

      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <section className="overflow-hidden rounded-card border border-border bg-card">
        {rows === null ? (
          <p className="px-[18px] py-4 text-small text-muted">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="px-[18px] py-4 text-small text-muted">{q ? "Aucun contact ne correspond." : "Aucun contact pour l’instant."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-body">
              <thead>
                <tr className="border-b border-rule text-left text-small font-medium text-muted">
                  <th className="px-4 py-2">Nom</th>
                  <th className="px-3 py-2">Fonction</th>
                  <th className="px-3 py-2">Lead</th>
                  <th className="px-3 py-2">Téléphone</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="w-28 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-medium">
                      {c.name}
                      {c.isPrimary && <span className="ml-2 rounded-md bg-accent-soft px-2 py-0.5 text-small font-bold text-accent-press">Principal</span>}
                    </td>
                    <td className="px-3 py-2 text-muted">{c.role || "—"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/leads/${c.leadId}`} className="hover:underline">{c.leadName}</Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-small">{c.whatsapp || c.phone || "—"}</td>
                    <td className="px-3 py-2 text-small">{c.email || "—"}</td>
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

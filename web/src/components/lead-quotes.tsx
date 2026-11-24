"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, describeError, downloadFrom } from "@/lib/api";
import { STATUS_LABEL, STATUS_TOKEN, fmt, type Quote } from "@/lib/quotes";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { PlusIcon } from "./icons";
import { QuoteImportModal } from "./quote-import-modal";
import { Button, Notice } from "./ui";

/** Onglet « Devis » d'un lead : la liste, et un bouton pour en commencer un nouveau (brouillon). */
export function LeadQuotes({ leadId, canWrite }: { leadId: string; canWrite: boolean }) {
  const { companyId } = useSession();
  const [list, setList] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => api<Quote[]>(`/leads/${leadId}/quotes`, { companyId }).then(setList).catch((e) => setError(describeError(e))), [leadId, companyId]);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const q = await api<Quote>(`/leads/${leadId}/quotes`, { companyId, body: { title: "Devis", lines: [], taxRate: 0 } });
      window.location.assign(ROUTES.quote(q.id)); // on ouvre tout de suite le brouillon pour le remplir
    } catch (e) {
      setError(describeError(e));
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        {canWrite && (
          <Button className="h-9 w-auto" loading={creating} onClick={create}>
            <PlusIcon size={16} /> Nouveau devis
          </Button>
        )}
        {canWrite && (
          <Button variant="secondary" className="h-9 w-auto" onClick={() => setImporting(true)}>
            Importer
          </Button>
        )}
        {(list?.length ?? 0) > 0 && (
          <>
            <Button variant="secondary" className="h-9 w-auto" onClick={() => downloadFrom(`/quotes/export?format=csv&leadId=${leadId}`, companyId, "devis.csv").catch((e) => setError(describeError(e)))}>
              Exporter (CSV)
            </Button>
            <Button variant="secondary" className="h-9 w-auto" onClick={() => downloadFrom(`/quotes/export?format=json&leadId=${leadId}`, companyId, "devis.json").catch((e) => setError(describeError(e)))}>
              Exporter (JSON)
            </Button>
          </>
        )}
      </div>
      {importing && <QuoteImportModal leadId={leadId} onClose={() => setImporting(false)} onDone={load} />}
      {list === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="text-small text-muted">Aucun devis pour ce lead.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((q) => (
            <li key={q.id}>
              <Link href={ROUTES.quote(q.id)} className="flex flex-wrap items-center gap-3 rounded-card border border-border p-3 hover:border-ink">
                <span className="font-mono text-small text-muted">{q.number}</span>
                <span className="min-w-0 flex-1 font-medium">{q.title}</span>
                <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md border border-border px-2 text-small font-medium">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${STATUS_TOKEN[q.status]})` }} />
                  {STATUS_LABEL[q.status]}
                </span>
                <span className="w-28 text-right font-mono">{fmt(q.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { INVOICE_LABEL, INVOICE_TOKEN, type Invoice } from "@/lib/invoices";
import { fmt } from "@/lib/quotes";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";

/** Les factures d'un lead (carte de la fiche). On en crée depuis un devis accepté. */
export function LeadInvoices({ leadId }: { leadId: string }) {
  const { companyId } = useSession();
  const [list, setList] = useState<Invoice[] | null>(null);
  useEffect(() => {
    api<Invoice[]>(`/leads/${leadId}/invoices`, { companyId }).then(setList).catch(() => setList([]));
  }, [leadId, companyId]);
  if (list === null) return <p className="text-small text-muted">Chargement…</p>;
  if (list.length === 0) return <p className="text-small text-muted">Aucune facture. Acceptez un devis, puis « Créer la facture ».</p>;
  return (
    <ul className="flex flex-col gap-2">
      {list.map((i) => (
        <li key={i.id}>
          <Link href={ROUTES.invoice(i.id)} className="flex flex-wrap items-center gap-3 rounded-card border border-border p-3 hover:border-ink">
            <span className="font-mono text-small text-muted">{i.number}</span>
            <span className="min-w-0 flex-1 font-medium">{i.title}</span>
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md border border-border px-2 text-small font-medium">
              <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${INVOICE_TOKEN[i.status]})` }} />
              {INVOICE_LABEL[i.status]}
            </span>
            <span className="w-24 text-right font-mono">{fmt(i.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

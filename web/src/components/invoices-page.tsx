"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { INVOICE_LABEL, INVOICE_TOKEN, isOverdue, type Invoice } from "@/lib/invoices";
import { fmt } from "@/lib/quotes";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { Notice } from "./ui";

type Row = Invoice & { leadName: string };

/** Factures : toutes celles des leads qu'on peut lire, avec ce qu'il reste à encaisser (envoyées, pas encore payées). */
export function InvoicesPage() {
  const { companyId } = useSession();
  const [data, setData] = useState<{ items: Row[]; outstanding: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ items: Row[]; outstanding: number }>("/invoices", { companyId }).then(setData).catch((e) => setError(describeError(e)));
  }, [companyId]);
  const late = (data?.items ?? []).filter((i) => isOverdue(i));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-title font-semibold">Factures</h1>
        <p className="text-small text-muted">Créez une facture depuis un devis accepté (page du devis) ou depuis la fiche d’un lead.</p>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <dl className="grid grid-cols-2 gap-3 md:max-w-[520px]">
        <div className="rounded-card border border-border bg-card p-4"><dt className="text-small text-muted">À encaisser</dt><dd className="font-mono text-stat font-semibold">{data ? fmt(data.outstanding) : "—"}</dd></div>
        <div className="rounded-card border border-border bg-card p-4"><dt className="text-small text-muted">En retard</dt><dd className={`font-mono text-stat font-semibold ${late.length ? "text-fail" : ""}`}>{data ? late.length : "—"}</dd></div>
      </dl>
      <section className="overflow-hidden rounded-card border border-border bg-card">
        {data === null ? (
          <p className="px-[18px] py-4 text-small text-muted">Chargement…</p>
        ) : data.items.length === 0 ? (
          <p className="px-[18px] py-10 text-center text-small text-muted">Aucune facture pour l’instant.</p>
        ) : (
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-rule bg-field text-left text-small text-muted">
                <th className="px-4 py-2 font-medium">Numéro</th>
                <th className="px-3 py-2 font-medium">Lead</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Échéance</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {data.items.map((i) => (
                <tr key={i.id} className="hover:bg-field">
                  <td className="px-4 py-2"><Link href={ROUTES.invoice(i.id)} className="font-mono text-small font-medium text-link hover:underline">{i.number}</Link></td>
                  <td className="px-3 py-2">{i.leadName}</td>
                  <td className="px-3 py-2 text-small"><span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: `var(${INVOICE_TOKEN[i.status]})` }} />{INVOICE_LABEL[i.status]}</span></td>
                  <td className={`px-3 py-2 text-small ${isOverdue(i) ? "font-medium text-fail" : "text-muted"}`}>{i.dueOn ? new Date(`${i.dueOn}T12:00:00`).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

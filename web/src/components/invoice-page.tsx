"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { useCrumb } from "@/lib/crumb";
import { INVOICE_LABEL, INVOICE_TOKEN, isOverdue, type Invoice } from "@/lib/invoices";
import { cleanLines, fmt, lineTotal, parseNumber, totals } from "@/lib/quotes";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Notice, TextArea } from "./ui";

type Row = { label: string; quantity: string; unitPrice: string };
const toRows = (i: Invoice): Row[] => (i.lines.length ? i.lines.map((l) => ({ label: l.label, quantity: String(l.quantity), unitPrice: String(l.unitPrice) })) : [{ label: "", quantity: "1", unitPrice: "" }]);

/** Une facture : brouillon modifiable, puis envoyée (figée), payée ou annulée. Imprimable (le menu disparaît à l'impression). */
export function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, companyId } = useSession();
  const canWrite = me.memberships[0].permissions.some((p) => p.permission === "lead:update");
  const [inv, setInv] = useState<Invoice | null>(null);
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [tax, setTax] = useState("0");
  const [dueOn, setDueOn] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useCrumb(inv ? `Facture ${inv.number}` : null);

  const apply = (i: Invoice) => {
    setInv(i);
    setTitle(i.title);
    setRows(toRows(i));
    setTax(String(i.taxRate));
    setDueOn(i.dueOn ?? "");
    setNotes(i.notes);
  };
  useEffect(() => {
    api<Invoice>(`/invoices/${id}`, { companyId })
      .then(apply)
      .catch((e) => setError(describeError(e)));
  }, [id, companyId]);

  if (!inv) return error ? <Notice onClose={() => setError(null)}>{error}</Notice> : <p className="text-small text-muted">Chargement…</p>;

  const editable = inv.status === "draft" && canWrite;
  const cleaned = cleanLines(rows);
  const taxRate = parseNumber(tax);
  const live = cleaned.ok ? totals(cleaned.lines, taxRate !== null && Number.isInteger(taxRate) && taxRate <= 100 ? taxRate : 0) : null;
  const shown = editable && live ? live : { subtotal: inv.subtotal, tax: inv.tax, total: inv.total };

  async function save(): Promise<boolean> {
    if (!cleaned.ok) return setError(cleaned.message), false;
    if (taxRate === null || !Number.isInteger(taxRate) || taxRate > 100) return setError("La taxe est un pourcentage entier entre 0 et 100."), false;
    try {
      apply(await api<Invoice>(`/invoices/${id}`, { method: "PATCH", companyId, body: { title: title.trim() || "Facture", lines: cleaned.lines, taxRate, dueOn: dueOn || null, notes } }));
      setError(null);
      return true;
    } catch (e) {
      setError(describeError(e));
      return false;
    }
  }
  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  const go = (status: "sent" | "paid" | "cancelled") =>
    run(status, async () => {
      if (status === "cancelled" && !window.confirm(`Annuler la facture ${inv.number} ? Cette action est définitive.`)) return;
      if (editable && status === "sent" && !(await save())) return;
      try {
        apply(await api<Invoice>(`/invoices/${id}/status`, { companyId, body: { status } }));
      } catch (e) {
        setError(describeError(e));
      }
    });

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
      <nav aria-label="Fil d'Ariane" className="text-small text-muted print:hidden">
        <Link href={ROUTES.lead(inv.leadId)} className="hover:underline">{inv.leadName || "Lead"}</Link> › <span className="font-medium text-ink">Facture {inv.number}</span>
      </nav>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-small text-muted">{inv.number}</p>
          {editable ? <Field label="Titre de la facture" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} /> : <h1 className="font-display text-title font-semibold">{inv.title}</h1>}
          <p className="mt-1 text-small text-muted">
            Pour {inv.leadName || "—"} · {inv.dueOn ? `à payer avant le ${new Date(`${inv.dueOn}T12:00:00`).toLocaleDateString("fr-FR")}` : "sans échéance"}
            {isOverdue(inv) && <span className="ml-2 font-medium text-fail">en retard</span>}
          </p>
        </div>
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-md border border-border px-3 text-small font-medium">
          <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${INVOICE_TOKEN[inv.status]})` }} />
          {INVOICE_LABEL[inv.status]}
        </span>
      </div>

      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="border-b border-rule text-left text-small text-muted">
            <th className="py-2 pr-2 font-medium">Désignation</th>
            <th className="w-24 py-2 pr-2 text-right font-medium">Quantité</th>
            <th className="w-32 py-2 pr-2 text-right font-medium">Prix unitaire</th>
            <th className="w-32 py-2 text-right font-medium">Total</th>
            {editable && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {(editable ? rows : inv.lines.map((l) => ({ label: l.label, quantity: String(l.quantity), unitPrice: String(l.unitPrice) }))).map((r, i) => (
            <tr key={i} className="border-b border-rule align-top">
              {editable ? (
                <>
                  <td className="py-2 pr-2"><input aria-label={`Désignation ligne ${i + 1}`} value={r.label} maxLength={200} onChange={(e) => setRows((c) => c.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="h-9 w-full rounded-control border border-border bg-field px-2" /></td>
                  <td className="py-2 pr-2"><input aria-label={`Quantité ligne ${i + 1}`} inputMode="decimal" value={r.quantity} onChange={(e) => setRows((c) => c.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className="h-9 w-full rounded-control border border-border bg-field px-2 text-right font-mono" /></td>
                  <td className="py-2 pr-2"><input aria-label={`Prix unitaire ligne ${i + 1}`} inputMode="numeric" value={r.unitPrice} onChange={(e) => setRows((c) => c.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} className="h-9 w-full rounded-control border border-border bg-field px-2 text-right font-mono" /></td>
                  <td className="py-3 text-right font-mono">{(() => { const q = parseNumber(r.quantity); const p = parseNumber(r.unitPrice); return q !== null && p !== null ? fmt(lineTotal({ label: "", quantity: q, unitPrice: p })) : "—"; })()}</td>
                  <td className="py-2 text-right"><button type="button" aria-label={`Retirer la ligne ${i + 1}`} onClick={() => setRows((c) => (c.length > 1 ? c.filter((_, j) => j !== i) : c))} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail"><TrashIcon size={15} /></button></td>
                </>
              ) : (
                <>
                  <td className="py-3 pr-2">{r.label}</td>
                  <td className="py-3 pr-2 text-right font-mono">{r.quantity}</td>
                  <td className="py-3 pr-2 text-right font-mono">{fmt(Number(r.unitPrice))}</td>
                  <td className="py-3 text-right font-mono">{fmt(lineTotal({ label: "", quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) }))}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <Button variant="secondary" className="h-9 w-auto self-start print:hidden" onClick={() => setRows((c) => [...c, { label: "", quantity: "1", unitPrice: "" }])}>
          <PlusIcon size={16} /> Ajouter une ligne
        </Button>
      )}

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {editable ? (
            <div className="flex flex-col gap-3">
              <div className="grid max-w-[360px] grid-cols-2 gap-3">
                <Field label="Taxe (%)" inputMode="numeric" value={tax} onChange={(e) => setTax(e.target.value)} className="font-mono" />
                <Field label="À payer avant le" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
              </div>
              <TextArea label="Notes (coordonnées de paiement…)" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          ) : (
            inv.notes && <p className="whitespace-pre-wrap text-small text-muted">{inv.notes}</p>
          )}
        </div>
        <dl className="w-64 shrink-0 text-body">
          <div className="flex justify-between py-1"><dt className="text-muted">Sous-total</dt><dd className="font-mono">{fmt(shown.subtotal)}</dd></div>
          <div className="flex justify-between py-1"><dt className="text-muted">Taxe ({editable ? (taxRate ?? 0) : inv.taxRate} %)</dt><dd className="font-mono">{fmt(shown.tax)}</dd></div>
          <div className="mt-1 flex justify-between border-t border-ink py-2 text-title font-semibold"><dt>Total</dt><dd className="font-mono">{fmt(shown.total)}</dd></div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-rule pt-4 print:hidden">
        {editable && (
          <>
            <Button loading={busy === "save"} className="h-9 w-auto" variant="secondary" onClick={() => run("save", async () => void (await save()))}>Enregistrer le brouillon</Button>
            <Button loading={busy === "sent"} className="h-9 w-auto" onClick={() => go("sent")}>Marquer comme envoyée</Button>
            <Button loading={busy === "delete"} className="h-9 w-auto" variant="secondary" onClick={() => run("delete", async () => {
              if (!window.confirm(`Supprimer le brouillon ${inv.number} ?`)) return;
              await api(`/invoices/${id}`, { method: "DELETE", companyId }).then(() => router.replace(ROUTES.lead(inv.leadId))).catch((e) => setError(describeError(e)));
            })}>Supprimer</Button>
          </>
        )}
        {inv.status === "sent" && canWrite && <Button loading={busy === "paid"} className="h-9 w-auto" onClick={() => go("paid")}>Marquer comme payée</Button>}
        {(inv.status === "draft" || inv.status === "sent") && canWrite && <Button loading={busy === "cancelled"} className="h-9 w-auto" variant="secondary" onClick={() => go("cancelled")}>Annuler la facture</Button>}
        <Button className="h-9 w-auto" variant="secondary" onClick={() => window.print()}>Imprimer / PDF</Button>
      </div>
    </div>
  );
}

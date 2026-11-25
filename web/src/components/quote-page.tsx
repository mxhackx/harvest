"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { STATUS_LABEL, STATUS_TOKEN, cleanLines, fmt, lineTotal, parseNumber, totals, type Quote, type QuoteStatus } from "@/lib/quotes";
import { ROUTES } from "@/lib/routes";
import { useCrumb } from "@/lib/crumb";
import { useSession } from "@/lib/session";
import { PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Notice, TextArea } from "./ui";

type Row = { label: string; quantity: string; unitPrice: string };
const toRows = (q: Quote): Row[] => (q.lines.length ? q.lines.map((l) => ({ label: l.label, quantity: String(l.quantity), unitPrice: String(l.unitPrice) })) : [{ label: "", quantity: "1", unitPrice: "" }]);

/**
 * Un devis. Brouillon : on remplit les lignes, la taxe et la validité, et on l'envoie. Envoyé ou décidé : vue figée,
 * imprimable (le menu disparaît à l'impression : « Imprimer » donne une page propre, à enregistrer en PDF).
 */
export function QuotePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, companyId } = useSession();
  const canWrite = me.memberships[0].permissions.some((p) => p.permission === "lead:update");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [tax, setTax] = useState("0");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useCrumb(quote ? `Devis ${quote.number}` : null);

  const apply = (q: Quote) => {
    setQuote(q);
    setTitle(q.title);
    setRows(toRows(q));
    setTax(String(q.taxRate));
    setValidUntil(q.validUntil ?? "");
    setNotes(q.notes);
  };
  useEffect(() => {
    api<Quote>(`/quotes/${id}`, { companyId })
      .then(apply)
      .catch((e) => setError(describeError(e)));
  }, [id, companyId]);

  if (!quote) return error ? <Notice onClose={() => setError(null)}>{error}</Notice> : <p className="text-small text-muted">Chargement…</p>;

  const editable = quote.status === "draft" && canWrite;
  const cleaned = cleanLines(rows);
  const taxRate = parseNumber(tax);
  const live = cleaned.ok ? totals(cleaned.lines, taxRate !== null && Number.isInteger(taxRate) && taxRate <= 100 ? taxRate : 0) : null;
  const shown = editable ? (live ?? { subtotal: quote.subtotal, tax: quote.tax, total: quote.total }) : { subtotal: quote.subtotal, tax: quote.tax, total: quote.total };

  async function save(): Promise<boolean> {
    if (!cleaned.ok) {
      setError(cleaned.message);
      return false;
    }
    if (taxRate === null || !Number.isInteger(taxRate) || taxRate > 100) {
      setError("La taxe est un pourcentage entier entre 0 et 100.");
      return false;
    }
    try {
      apply(await api<Quote>(`/quotes/${id}`, { method: "PATCH", companyId, body: { title: title.trim() || "Devis", lines: cleaned.lines, taxRate, validUntil: validUntil || null, notes } }));
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
  const go = (status: Exclude<QuoteStatus, "draft">) =>
    run(status, async () => {
      if (editable && !(await save())) return;
      try {
        apply(await api<Quote>(`/quotes/${id}/status`, { companyId, body: { status } }));
      } catch (e) {
        setError(describeError(e));
      }
    });
  const remove = () =>
    run("delete", async () => {
      if (!window.confirm(`Supprimer le brouillon ${quote.number} ?`)) return;
      try {
        await api(`/quotes/${id}`, { method: "DELETE", companyId });
        router.replace(ROUTES.lead(quote.leadId));
      } catch (e) {
        setError(describeError(e));
      }
    });

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
      <nav aria-label="Fil d'Ariane" className="text-small text-muted print:hidden">
        <Link href={ROUTES.lead(quote.leadId)} className="hover:underline">{quote.leadName || "Lead"}</Link> › <span className="font-medium text-ink">Devis {quote.number}</span>
      </nav>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-small text-muted">{quote.number}</p>
          {editable ? <Field label="Titre du devis" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} /> : <h1 className="font-display text-title font-semibold">{quote.title}</h1>}
          <p className="mt-1 text-small text-muted">
            Pour {quote.leadName || "—"} · {quote.validUntil ? `valable jusqu’au ${new Date(`${quote.validUntil}T12:00:00`).toLocaleDateString("fr-FR")}` : "sans date de validité"}
          </p>
        </div>
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-md border border-border px-3 text-small font-medium">
          <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${STATUS_TOKEN[quote.status]})` }} />
          {STATUS_LABEL[quote.status]}
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
          {(editable ? rows : quote.lines.map((l) => ({ label: l.label, quantity: String(l.quantity), unitPrice: String(l.unitPrice) }))).map((r, i) => (
            <tr key={i} className="border-b border-rule align-top">
              {editable ? (
                <>
                  <td className="py-2 pr-2">
                    <input aria-label={`Désignation ligne ${i + 1}`} value={r.label} maxLength={200} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="h-9 w-full rounded-control border border-border bg-field px-2" />
                  </td>
                  <td className="py-2 pr-2">
                    <input aria-label={`Quantité ligne ${i + 1}`} inputMode="decimal" value={r.quantity} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className="h-9 w-full rounded-control border border-border bg-field px-2 text-right font-mono" />
                  </td>
                  <td className="py-2 pr-2">
                    <input aria-label={`Prix unitaire ligne ${i + 1}`} inputMode="numeric" value={r.unitPrice} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} className="h-9 w-full rounded-control border border-border bg-field px-2 text-right font-mono" />
                  </td>
                  <td className="py-3 text-right font-mono">{(() => { const q = parseNumber(r.quantity); const p = parseNumber(r.unitPrice); return q !== null && p !== null ? fmt(lineTotal({ label: "", quantity: q, unitPrice: p })) : "—"; })()}</td>
                  <td className="py-2 text-right">
                    <button type="button" aria-label={`Retirer la ligne ${i + 1}`} onClick={() => setRows((cur) => (cur.length > 1 ? cur.filter((_, j) => j !== i) : cur))} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                      <TrashIcon size={15} />
                    </button>
                  </td>
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
        <Button variant="secondary" className="h-9 w-auto self-start print:hidden" onClick={() => setRows((cur) => [...cur, { label: "", quantity: "1", unitPrice: "" }])}>
          <PlusIcon size={16} /> Ajouter une ligne
        </Button>
      )}

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {editable ? (
            <div className="flex flex-col gap-3">
              <div className="grid max-w-[360px] grid-cols-2 gap-3">
                <Field label="Taxe (%)" inputMode="numeric" value={tax} onChange={(e) => setTax(e.target.value)} className="font-mono" />
                <Field label="Valable jusqu’au" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
              <TextArea label="Notes (conditions, délais…)" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          ) : (
            quote.notes && <p className="whitespace-pre-wrap text-small text-muted">{quote.notes}</p>
          )}
        </div>
        <dl className="w-64 shrink-0 text-body">
          <div className="flex justify-between py-1"><dt className="text-muted">Sous-total</dt><dd className="font-mono">{fmt(shown.subtotal)}</dd></div>
          <div className="flex justify-between py-1"><dt className="text-muted">Taxe ({editable ? (taxRate ?? 0) : quote.taxRate} %)</dt><dd className="font-mono">{fmt(shown.tax)}</dd></div>
          <div className="mt-1 flex justify-between border-t border-ink py-2 text-title font-semibold"><dt>Total</dt><dd className="font-mono">{fmt(shown.total)}</dd></div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-rule pt-4 print:hidden">
        {editable && (
          <>
            <Button loading={busy === "save"} className="h-9 w-auto" variant="secondary" onClick={() => run("save", async () => void (await save()))}>
              Enregistrer le brouillon
            </Button>
            <Button loading={busy === "sent"} className="h-9 w-auto" onClick={() => go("sent")}>
              Marquer comme envoyé
            </Button>
            <Button loading={busy === "delete"} className="h-9 w-auto" variant="secondary" onClick={remove}>
              Supprimer
            </Button>
          </>
        )}
        {quote.status === "sent" && canWrite && (
          <>
            <Button loading={busy === "accepted"} className="h-9 w-auto" onClick={() => go("accepted")}>
              Le client accepte
            </Button>
            <Button loading={busy === "declined"} className="h-9 w-auto" variant="secondary" onClick={() => go("declined")}>
              Le client refuse
            </Button>
          </>
        )}
        {quote.status === "accepted" && canWrite && (
          <Button loading={busy === "invoice"} className="h-9 w-auto" onClick={() => run("invoice", async () => {
            try {
              const inv = await api<{ id: string }>(`/quotes/${id}/invoice`, { companyId, body: {} });
              router.push(ROUTES.invoice(inv.id));
            } catch (e) {
              setError(describeError(e));
            }
          })}>
            Créer la facture
          </Button>
        )}
        <Button className="h-9 w-auto" variant="secondary" onClick={() => window.print()}>
          Imprimer / PDF
        </Button>
      </div>
    </div>
  );
}

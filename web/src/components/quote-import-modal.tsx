"use client";

import { useState } from "react";
import { api, describeError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, Modal, Notice, TextArea } from "./ui";

type Report = { dryRun: boolean; valid: number; errors: { row: number; message: string }[]; created: { number: string; title: string }[] };

/** Importer des devis d'un fichier JSON ou CSV : on analyse d'abord (rapport), puis on crée les brouillons. */
export function QuoteImportModal({ leadId, onClose, onDone }: { leadId: string; onClose: () => void; onDone: () => void }) {
  const { companyId } = useSession();
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [content, setContent] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (dryRun: boolean) => {
    setBusy(dryRun ? "check" : "import");
    try {
      const r = await api<Report>(`/leads/${leadId}/quotes/import`, { companyId, body: { format, content, dryRun } });
      setReport(r);
      setError(null);
      if (!dryRun && r.created.length > 0) onDone();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFormat(file.name.toLowerCase().endsWith(".json") ? "json" : "csv");
    setContent(await file.text());
    setReport(null);
  };

  return (
    <Modal title="Importer des devis" description="Fichier JSON ou CSV : chaque devis devient un brouillon, numéroté ici." onClose={onClose} width="max-w-[620px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <label className="flex flex-col gap-2 text-small font-semibold">
          Fichier (.json ou .csv)
          <input type="file" accept=".json,.csv,application/json,text/csv" onChange={(e) => pick(e.target.files?.[0])} className="text-body font-normal" />
        </label>
        <TextArea label={`…ou collez le contenu (${format.toUpperCase()})`} rows={6} value={content} onChange={(e) => { setContent(e.target.value); setReport(null); }} className="font-mono" />
        <div className="flex gap-2 text-small">
          {(["csv", "json"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={format === f} onClick={() => { setFormat(f); setReport(null); }} className={`h-8 rounded-full border px-3 font-medium ${format === f ? "border-accent bg-accent-soft" : "border-frame"}`}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        {report && (
          <div role="status" className="rounded-control border border-border bg-field p-3 text-small">
            {report.dryRun ? (
              <p className="font-medium">{report.valid} devis valide{report.valid > 1 ? "s" : ""}, {report.errors.length} erreur{report.errors.length > 1 ? "s" : ""}.</p>
            ) : (
              <p className="font-medium">{report.created.length} brouillon{report.created.length > 1 ? "s" : ""} créé{report.created.length > 1 ? "s" : ""} : {report.created.map((c) => c.number).join(", ")}</p>
            )}
            {report.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-fail">
                {report.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>{e.row ? `Devis ${e.row} : ` : ""}{e.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>
            {report && !report.dryRun ? "Fermer" : "Annuler"}
          </Button>
          <Button variant="secondary" className="sm:w-auto" loading={busy === "check"} disabled={!content.trim()} onClick={() => run(true)}>
            Analyser
          </Button>
          <Button className="sm:w-auto" loading={busy === "import"} disabled={!report?.dryRun || report.valid === 0} onClick={() => run(false)}>
            Importer {report?.dryRun && report.valid > 0 ? `(${report.valid})` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

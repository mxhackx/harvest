"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { describeError, importLeads, type ImportReport } from "@/lib/api";
import { stageOf } from "@/lib/stages";
import { useStages } from "@/lib/stages-store";
import { useSession } from "@/lib/session";
import { UploadIcon } from "./icons";
import { Button, Modal, Notice, TextArea } from "./ui";

const MAX_BYTES = 1_500_000;
const link = "font-medium text-link underline decoration-dotted decoration-2 underline-offset-4";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-control bg-field px-3 py-2 text-center">
      <dd className={`font-mono text-title font-semibold ${tone === "warn" && value > 0 ? "text-ink" : ""}`}>{value}</dd>
      <dt className="text-small text-muted">{label}</dt>
    </div>
  );
}

export function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (r: ImportReport) => void }) {
  const { companyId } = useSession();
  const { stages } = useStages();
  const fileInput = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"csv" | "json" | undefined>();
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"analyze" | "import" | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) return setNotice(`Fichier trop volumineux (${Math.round(file.size / 1000)} Ko) : 1,5 Mo au plus, soit environ 1 000 leads.`);
    setContent(await file.text());
    setFileName(file.name);
    setFormat(/\.json$/i.test(file.name) ? "json" : /\.(csv|tsv|txt)$/i.test(file.name) ? "csv" : undefined);
    setReport(null);
    setNotice(null);
  }

  async function run(dryRun: boolean) {
    setBusy(dryRun ? "analyze" : "import");
    setNotice(null);
    try {
      const r = await importLeads({ content, format, dryRun, companyId });
      if (dryRun) setReport(r);
      else onImported(r);
    } catch (e) {
      setNotice(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal title="Importer des leads" description="Depuis un fichier CSV ou JSON" onClose={onClose} width="max-w-[760px]">
      <div className="flex flex-col gap-5">
        {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}

        {!report && (
          <>
            <div className="flex flex-col gap-3 rounded-control border border-dashed border-frame p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,.tsv,.txt,.json,text/csv,application/json"
                  onChange={(e) => pick(e.target.files?.[0])}
                  aria-label="Choisir un fichier CSV ou JSON"
                  className="sr-only"
                />
                <Button variant="secondary" onClick={() => fileInput.current?.click()} className="w-auto">
                  <UploadIcon size={16} /> Choisir un fichier
                </Button>
                <span className="text-small text-muted">{fileName ?? "CSV ou JSON, 1 000 leads au plus"}</span>
              </div>
              <p className="text-small text-muted">
                Une colonne <code className="font-mono">name</code> suffit ; les autres sont facultatives.{" "}
                <Link href="/docs/import" target="_blank" className={link}>
                  Voir le format attendu
                </Link>{" "}
                · Modèles :{" "}
                <a href="/templates/leads-modele.csv" download className={link}>
                  CSV
                </a>
                ,{" "}
                <a href="/templates/leads-modele.json" download className={link}>
                  JSON
                </a>
              </p>
            </div>
            <TextArea
              label="Ou collez le contenu ici"
              value={fileName ? "" : content}
              disabled={!!fileName}
              onChange={(e) => {
                setContent(e.target.value);
                setFormat(undefined);
                setReport(null);
              }}
              rows={4}
              placeholder={'name,city\nPharmacie Étoile,Cotonou'}
              className="font-mono text-small"
            />
            <div className="flex justify-end gap-2">
              {fileName && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFileName(null);
                    setContent("");
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                  className="sm:w-auto"
                >
                  Retirer le fichier
                </Button>
              )}
              <Button onClick={() => run(true)} loading={busy === "analyze"} disabled={!content.trim()} className="sm:w-auto">
                Analyser
              </Button>
            </div>
          </>
        )}

        {report && (
          <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={report.format === "json" ? "entrées" : "lignes"} value={report.total} />
              <Stat label="à importer" value={report.valid} />
              <Stat label="doublons ignorés" value={report.duplicates} tone="warn" />
              <Stat label="invalides ignorées" value={report.invalid} tone="warn" />
            </dl>

            {report.ignoredColumns.length > 0 && (
              <p className="text-small text-muted">
                Colonnes non reconnues, ignorées : <span className="font-mono">{report.ignoredColumns.join(", ")}</span>.{" "}
                <Link href="/docs/import/champs" target="_blank" className={link}>
                  Colonnes acceptées
                </Link>
              </p>
            )}

            {report.errors.length > 0 && (
              <section aria-label="Lignes invalides">
                <h3 className="mb-2 text-small font-semibold">Lignes ignorées</h3>
                <ul className="max-h-40 overflow-y-auto rounded-control border border-border">
                  {report.errors.slice(0, 50).map((e, i) => (
                    <li key={i} className={`flex gap-3 px-3 py-1.5 text-small ${i > 0 ? "border-t border-rule" : ""}`}>
                      <span className="w-16 shrink-0 font-mono text-muted">{report.format === "json" ? `n° ${e.line}` : `ligne ${e.line}`}</span>
                      {e.field && <span className="w-28 shrink-0 font-mono">{e.field}</span>}
                      <span>{e.message}</span>
                    </li>
                  ))}
                </ul>
                {(report.errors.length > 50 || report.errorsTruncated) && <p className="mt-1 text-small text-muted">… et d&apos;autres erreurs du même type.</p>}
              </section>
            )}

            {report.duplicates > 0 && (
              <p className="text-small text-muted">
                Doublons (même nom, téléphone et adresse qu&apos;un lead existant ou d&apos;une autre ligne) :{" "}
                {report.duplicateLines.slice(0, 5).map((d) => d.name).join(", ")}
                {report.duplicates > 5 ? "…" : ""}
              </p>
            )}

            {report.preview.length > 0 && (
              <section aria-label="Aperçu">
                <h3 className="mb-2 text-small font-semibold">Aperçu des {Math.min(5, report.valid)} premiers leads</h3>
                <ul className="rounded-control border border-border">
                  {report.preview.map((p, i) => (
                    <li key={p.line} className={`flex flex-wrap items-baseline gap-x-3 px-3 py-1.5 text-small ${i > 0 ? "border-t border-rule" : ""}`}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted">{stageOf(stages, p.status).name}</span>
                      {p.address && <span className="text-muted">{p.address}</span>}
                      <span className="ml-auto text-muted">{p.hasPosition ? "Position fournie" : p.toLocate ? "À localiser" : "Sans position"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setReport(null)} className="sm:w-auto">
                Changer de fichier
              </Button>
              <Button onClick={() => run(false)} loading={busy === "import"} disabled={report.valid === 0} className="sm:w-auto">
                {report.valid === 0 ? "Rien à importer" : `Importer ${plural(report.valid, "lead", "leads")}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

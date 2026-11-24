"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { describeAction, type AuditEntry } from "@/lib/audit";
import { useSession } from "@/lib/session";
import { Button, Notice } from "./ui";

type Page = { items: AuditEntry[]; next: string | null };

/** Journal d'audit : qui a fait quoi et quand (conservé un an), réservé à ceux qui en ont le droit. */
export function AuditPage() {
  const { companyId } = useSession();
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(
    (before?: string) => api<Page>(`/audit?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`, { companyId }),
    [companyId],
  );
  useEffect(() => {
    fetchPage()
      .then((page) => {
        setItems(page.items);
        setNext(page.next);
      })
      .catch((e) => setError(describeError(e)));
  }, [fetchPage]);

  const more = async () => {
    if (!next) return;
    setLoading(true);
    try {
      const page = await fetchPage(next);
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setNext(page.next);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-title font-semibold">Journal d’audit</h1>
        <p className="text-small text-muted">Chaque modification de données, avec son auteur. Conservé un an.</p>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {items === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucune action enregistrée pour l’instant.</p>
      ) : (
        <ul className="overflow-hidden rounded-card border border-border bg-card">
          {items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-4 py-3 last:border-b-0">
              <time dateTime={e.createdAt} className="w-36 shrink-0 font-mono text-small text-muted">
                {new Date(e.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </time>
              <p className="min-w-0 flex-1 text-body">
                <strong>{e.actorName ?? "Compte supprimé"}</strong> {describeAction(e.action)}
                {e.entityLabel && <> « {e.entityLabel} »</>}
              </p>
            </li>
          ))}
        </ul>
      )}
      {next && (
        <Button variant="secondary" className="h-9 w-auto self-start" loading={loading} onClick={more}>
          Voir plus
        </Button>
      )}
    </div>
  );
}

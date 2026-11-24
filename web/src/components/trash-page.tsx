"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError, type Lead } from "@/lib/api";
import { daysLeft, daysLeftLabel } from "@/lib/trash";
import { useSession } from "@/lib/session";
import { Button, Notice } from "./ui";

type Trashed = Lead & { deletedAt: string; deletedByName: string | null; purgeAt: string };

/** Corbeille : les leads supprimés restent 30 jours, avec leurs contacts, leur historique et leurs tâches. */
export function TrashPage() {
  const { companyId } = useSession();
  const [list, setList] = useState<Trashed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api<Trashed[]>("/leads/trash", { companyId }).then(setList).catch((e) => setError(describeError(e))), [companyId]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (lead: Trashed, action: "restore" | "purge") => {
    if (action === "purge" && !window.confirm(`Effacer définitivement « ${lead.name} » ? Ses contacts, son historique et ses tâches seront perdus.`)) return;
    setBusy(lead.id);
    try {
      await api(`/leads/trash/${action}`, { companyId, body: { ids: [lead.id] } });
      await load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-title font-semibold">Corbeille</h1>
        <p className="text-small text-muted">Un lead supprimé reste ici 30 jours avec ses contacts, son historique et ses tâches, puis il est effacé.</p>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {list === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">La corbeille est vide.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.name}</p>
                <p className="text-small text-muted">
                  Supprimé le {new Date(l.deletedAt).toLocaleDateString("fr-FR")}
                  {l.deletedByName ? ` par ${l.deletedByName}` : ""} · {daysLeftLabel(daysLeft(l.purgeAt))}
                </p>
              </div>
              <Button className="h-9 w-auto" loading={busy === l.id} onClick={() => act(l, "restore")}>
                Restaurer
              </Button>
              <Button variant="secondary" className="h-9 w-auto" disabled={busy === l.id} onClick={() => act(l, "purge")}>
                Effacer
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

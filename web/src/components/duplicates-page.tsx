"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { Button, Notice } from "./ui";

type Candidate = { id: string; name: string; city: string; phone: string; status: string; createdAt: string };
type Group = { reason: "phone" | "name"; leads: Candidate[] };

const WHY = { phone: "Même numéro de téléphone", name: "Même nom dans la même ville" } as const;

/** Doublons : on choisit le lead à garder, les autres sont fusionnés dedans (contacts, historique, tâches, e-mails). */
export function DuplicatesPage() {
  const { companyId } = useSession();
  const { reload } = useLeads();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [keep, setKeep] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(() => api<Group[]>("/leads/duplicates", { companyId }).then(setGroups).catch((e) => setError(describeError(e))), [companyId]);
  useEffect(() => {
    load();
  }, [load]);

  const merge = async (i: number, g: Group) => {
    const keepId = keep[i] ?? g.leads[0].id;
    const others = g.leads.filter((l) => l.id !== keepId);
    if (!window.confirm(`Fusionner ${others.map((o) => `« ${o.name} »`).join(", ")} dans « ${g.leads.find((l) => l.id === keepId)!.name} » ? Cette action est irréversible.`)) return;
    setBusy(i);
    try {
      await api("/leads/merge", { companyId, body: { keepId, mergeIds: others.map((o) => o.id) } });
      setDone(`${others.length} lead${others.length > 1 ? "s" : ""} fusionné${others.length > 1 ? "s" : ""}.`);
      await Promise.all([load(), reload()]);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-title font-semibold">Doublons</h1>
        <p className="text-small text-muted">Des leads qui semblent être la même entreprise. Choisissez celui à garder : les autres sont fusionnés dedans, sans rien perdre.</p>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {done && <Notice onClose={() => setDone(null)}>{done}</Notice>}
      {groups === null ? (
        <p className="text-small text-muted">Recherche…</p>
      ) : groups.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucun doublon trouvé.</p>
      ) : (
        groups.map((g, i) => (
          <fieldset key={g.leads.map((l) => l.id).join()} className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
            <legend className="px-1 text-small font-semibold text-muted">{WHY[g.reason]}</legend>
            {g.leads.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-3 rounded-control px-2 py-2 hover:bg-field">
                <input type="radio" name={`keep-${i}`} checked={(keep[i] ?? g.leads[0].id) === l.id} onChange={() => setKeep((k) => ({ ...k, [i]: l.id }))} className="size-4 accent-accent" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{l.name}</span>
                  <span className="block text-small text-muted">{[l.city, l.phone, `créé le ${new Date(l.createdAt).toLocaleDateString("fr-FR")}`].filter(Boolean).join(" · ")}</span>
                </span>
                {(keep[i] ?? g.leads[0].id) === l.id && <span className="text-small font-medium text-accent-press">À garder</span>}
              </label>
            ))}
            <Button className="mt-1 h-9 w-auto self-start" loading={busy === i} onClick={() => merge(i, g)}>
              Fusionner
            </Button>
          </fieldset>
        ))
      )}
    </div>
  );
}

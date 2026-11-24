"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, describeError } from "@/lib/api";
import { KIND_LABEL, MANUAL_KINDS, describeActivity, isManualKind, relativeTime, type Activity, type ActivityKind } from "@/lib/activity";
import { useSession } from "@/lib/session";
import { PencilIcon, TrashIcon } from "./icons";
import { Button, Notice, TextArea } from "./ui";

type Page = { items: Activity[]; next: string | null };

const DOT: Record<ActivityKind, string> = {
  note: "bg-accent",
  call: "bg-accent",
  message: "bg-accent",
  visit: "bg-accent",
  email: "bg-accent",
  created: "bg-muted",
  stage_change: "bg-forest",
  visited: "bg-forest",
  assigned: "bg-muted",
};

/** Fil d'activité d'un lead : saisies manuelles et événements du système, du plus récent au plus ancien. */
export function LeadActivity({ leadId, canWrite, version }: { leadId: string; canWrite: boolean; version: number }) {
  const { me, companyId } = useSession();
  const [items, setItems] = useState<Activity[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ActivityKind>("note");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  const load = useCallback(
    () =>
      api<Page>(`/leads/${leadId}/activities?limit=30`, { companyId })
        .then((page) => {
          setItems(page.items);
          setNext(page.next);
        })
        .catch((e) => setError(describeError(e))),
    [leadId, companyId],
  );

  // `version` change quand la fiche modifie le lead (étape, visite) : le fil se recharge
  useEffect(() => {
    load();
  }, [load, version]);

  async function more() {
    if (!next) return;
    try {
      const page = await api<Page>(`/leads/${leadId}/activities?limit=30&before=${encodeURIComponent(next)}`, { companyId });
      setItems((cur) => [...(cur ?? []), ...page.items]);
      setNext(page.next);
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await api(`/leads/${leadId}/activities`, { method: "POST", body: { kind, body: body.trim() }, companyId });
      setBody("");
      setError(null);
      await load();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSending(false);
    }
  }

  async function saveEdit() {
    if (!editing || !editing.body.trim()) return;
    try {
      await api(`/activities/${editing.id}`, { method: "PATCH", body: { body: editing.body.trim() }, companyId });
      setEditing(null);
      await load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function remove(id: string) {
    try {
      await api(`/activities/${id}`, { method: "DELETE", companyId });
      await load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      {canWrite && (
        <form onSubmit={add} className="flex flex-col gap-3 rounded-card border border-border bg-field/40 p-3">
          <div role="group" aria-label="Type d'activité" className="flex flex-wrap gap-1.5">
            {MANUAL_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                aria-pressed={kind === k.value}
                onClick={() => setKind(k.value)}
                className={`h-8 rounded-full border px-3 text-small font-medium ${kind === k.value ? "border-accent-hover bg-accent text-white" : "border-frame bg-card hover:bg-field"}`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <TextArea label="Ce qui s'est passé" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Ex. : a demandé un devis, à rappeler jeudi." />
          <div className="flex justify-end">
            <Button type="submit" className="h-9 w-auto" loading={sending} disabled={!body.trim()}>
              Ajouter
            </Button>
          </div>
        </form>
      )}

      {items === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-small text-muted">Aucune activité pour l’instant.</p>
      ) : (
        <ol className="flex flex-col">
          {items.map((a) => {
            const mine = a.authorId === me.user.id && isManualKind(a.kind);
            return (
              <li key={a.id} className="relative flex gap-3 border-l border-rule pb-5 pl-5 last:pb-0">
                <span aria-hidden className={`absolute -left-[5px] top-1.5 size-[9px] rounded-full ${DOT[a.kind]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-small text-muted">
                    <span className="font-semibold text-ink">{isManualKind(a.kind) ? KIND_LABEL[a.kind] : describeActivity(a)}</span>
                    {" · "}
                    {a.authorName ?? "Système"} · <time dateTime={a.occurredAt}>{relativeTime(a.occurredAt)}</time>
                  </p>
                  {editing?.id === a.id ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <TextArea label="Modifier le texte" value={editing.body} onChange={(e) => setEditing({ id: a.id, body: e.target.value })} maxLength={2000} />
                      <div className="flex gap-2">
                        <Button className="h-8 w-auto" onClick={saveEdit}>Enregistrer</Button>
                        <Button variant="secondary" className="h-8 w-auto" onClick={() => setEditing(null)}>Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    a.body && <p className="mt-1 whitespace-pre-wrap break-words text-body">{a.body}</p>
                  )}
                </div>
                {mine && editing?.id !== a.id && (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label="Modifier cette entrée" onClick={() => setEditing({ id: a.id, body: a.body })} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
                      <PencilIcon size={15} />
                    </button>
                    <button type="button" aria-label="Supprimer cette entrée" onClick={() => remove(a.id)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                      <TrashIcon size={15} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {next && (
        <Button variant="secondary" className="h-9 w-auto self-center" onClick={more}>
          Voir plus ancien
        </Button>
      )}
    </div>
  );
}

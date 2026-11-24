"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { EVENT_LABEL, webhookState, type Webhook } from "@/lib/webhooks";
import { useSession } from "@/lib/session";
import { PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice } from "./ui";

/** Webhooks : une adresse externe est prévenue (POST signé) quand un lead change. Réservé au CEO. */
export function WebhooksPage() {
  const { companyId } = useSession();
  const [list, setList] = useState<Webhook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(() => api<Webhook[]>("/webhooks", { companyId }).then(setList).catch((e) => setError(describeError(e))), [companyId]);
  useEffect(() => {
    load();
  }, [load]);

  const test = async (h: Webhook) => {
    setTesting(h.id);
    try {
      const r = await api<{ status: number | null }>(`/webhooks/${h.id}/test`, { companyId, body: {} });
      setError(r.status && r.status < 300 ? null : `Le test a échoué : ${r.status ?? "adresse injoignable"}.`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setTesting(null);
    }
  };
  const remove = async (h: Webhook) => {
    if (!window.confirm(`Supprimer le webhook ${new URL(h.url).host} ?`)) return;
    try {
      await api(`/webhooks/${h.id}`, { method: "DELETE", companyId });
      await load();
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Webhooks</h1>
          <p className="text-small text-muted">Prévenez un autre outil dès qu’un lead change. Chaque envoi est signé avec un secret.</p>
        </div>
        <Button className="h-9 w-auto" onClick={() => setCreating(true)}>
          <PlusIcon size={16} /> Nouveau webhook
        </Button>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {list === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucun webhook pour l’instant.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((h) => {
            const state = webhookState(h);
            return (
              <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-small font-semibold">{h.url}</p>
                  <p className="text-small text-muted">{h.events.map((e) => EVENT_LABEL[e] ?? e).join(" · ")}</p>
                  <p className={`text-small ${state.ok ? "text-muted" : "text-fail"}`}>{state.label}</p>
                </div>
                <Button variant="secondary" className="h-9 w-auto" loading={testing === h.id} onClick={() => test(h)}>
                  Tester
                </Button>
                <button type="button" aria-label={`Supprimer ${h.url}`} onClick={() => remove(h)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                  <TrashIcon size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {creating && (
        <CreateWebhook
          onClose={() => setCreating(false)}
          onCreated={(s) => {
            setCreating(false);
            setSecret(s);
            load();
          }}
        />
      )}
      {secret && (
        <Modal title="Secret de signature" description="Copiez-le maintenant : il ne sera plus affiché." onClose={() => setSecret(null)} width="max-w-[520px]">
          <div className="flex flex-col gap-4 p-[18px]">
            <code className="break-all rounded-control bg-field p-3 font-mono text-small">{secret}</code>
            <div className="flex justify-end">
              <Button className="sm:w-auto" onClick={() => setSecret(null)}>
                J’ai copié le secret
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateWebhook({ onClose, onCreated }: { onClose: () => void; onCreated: (secret: string) => void }) {
  const { companyId } = useSession();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["lead.created"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ secret: string }>("/webhooks", { companyId, body: { url: url.trim(), events } });
      onCreated(r.secret);
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };
  return (
    <Modal title="Nouveau webhook" description="L’adresse doit commencer par https://" onClose={onClose} width="max-w-[520px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Adresse (URL)" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exemple.fr/hivation" className="font-mono" />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-small font-semibold">Événements</legend>
          {Object.entries(EVENT_LABEL).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-body">
              <input type="checkbox" className="size-4 accent-accent" checked={events.includes(key)} onChange={(e) => setEvents((cur) => (e.target.checked ? [...cur, key] : cur.filter((k) => k !== key)))} />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button className="sm:w-auto" loading={busy} disabled={!url.trim() || events.length === 0} onClick={save}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

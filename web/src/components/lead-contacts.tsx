"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError, downloadFrom } from "@/lib/api";
import type { Contact } from "@/lib/activity";
import { useSession } from "@/lib/session";
import { DownloadIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "./icons";
import { Button, Notice } from "./ui";
import { ContactForm, type ContactValues } from "./contact-form";

/** Les personnes à contacter dans l'entreprise ; une seule est « principale » et donne son nom au lead. */
export function LeadContacts({ leadId, canWrite, onChanged }: { leadId: string; canWrite: boolean; onChanged: () => void }) {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((x) => x.permission);
  const [list, setList] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Contact | "new" | null>(null);

  const load = useCallback(
    () =>
      api<Contact[]>(`/leads/${leadId}/contacts`, { companyId })
        .then(setList)
        .catch((e) => setError(describeError(e))),
    [leadId, companyId],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      setError(null);
      await load();
      onChanged();
    } catch (e) {
      setError(describeError(e));
      throw e;
    }
  }

  /** RGPD : télécharger tout ce qu'on garde sur la personne, ou l'effacer pour de bon (après confirmation). */
  const exportData = (c: Contact) => downloadFrom(`/contacts/${c.id}/export`, companyId, `contact-${c.id}.json`).catch((e) => setError(describeError(e)));
  const erase = (c: Contact) => {
    if (!window.confirm(`Effacer définitivement ${c.name} (droit à l’effacement) ? Cette action est irréversible.`)) return;
    run(() => api(`/contacts/${c.id}/erase`, { companyId, body: { confirm: true } })).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {canWrite && (
        <Button variant="secondary" className="h-9 w-auto self-start" onClick={() => setForm("new")}>
          <PlusIcon size={16} /> Ajouter un contact
        </Button>
      )}
      {list === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="text-small text-muted">Aucun contact enregistré.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((c) => (
            <li key={c.id} className="rounded-card border border-border p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {c.name}
                    {c.isPrimary && <span className="ml-2 rounded-md bg-accent-soft px-2 py-0.5 text-small font-bold text-accent-press">Principal</span>}
                  </p>
                  {c.role && <p className="text-small text-muted">{c.role}</p>}
                </div>
                {(canWrite || perms.includes("lead:export") || perms.includes("lead:delete")) && (
                  <div className="flex shrink-0 gap-1">
                    {perms.includes("lead:export") && (
                      <button type="button" aria-label={`Exporter les données de ${c.name}`} title="Exporter ses données (RGPD)" onClick={() => exportData(c)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
                        <DownloadIcon size={15} />
                      </button>
                    )}
                    {perms.includes("lead:delete") && (
                      <button type="button" aria-label={`Effacer ${c.name} (RGPD)`} title="Effacer définitivement (RGPD)" onClick={() => erase(c)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                        <XIcon size={15} />
                      </button>
                    )}
                    {canWrite && (<>
                    <button type="button" aria-label={`Modifier ${c.name}`} onClick={() => setForm(c)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
                      <PencilIcon size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Supprimer ${c.name}`}
                      onClick={() => run(() => api(`/contacts/${c.id}`, { method: "DELETE", companyId })).catch(() => {})}
                      className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail"
                    >
                      <TrashIcon size={15} />
                    </button>
                    </>)}
                  </div>
                )}
              </div>
              <dl className="mt-2 grid grid-cols-[84px_1fr] gap-x-3 gap-y-1 text-small">
                {c.phone && (<><dt className="text-muted">Téléphone</dt><dd className="font-mono">{c.phone}</dd></>)}
                {c.whatsapp && (<><dt className="text-muted">WhatsApp</dt><dd className="font-mono">{c.whatsapp}</dd></>)}
                {c.email && (<><dt className="text-muted">E-mail</dt><dd className="break-all">{c.email}</dd></>)}
                {c.notes && (<><dt className="text-muted">Notes</dt><dd className="whitespace-pre-wrap">{c.notes}</dd></>)}
              </dl>
              {canWrite && !c.isPrimary && (
                <button
                  type="button"
                  onClick={() => run(() => api(`/contacts/${c.id}`, { method: "PATCH", body: { isPrimary: true }, companyId })).catch(() => {})}
                  className="mt-2 text-small font-medium text-accent-press hover:underline"
                >
                  Définir comme principal
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {form && (
        <ContactForm
          contact={form === "new" ? undefined : form}
          siblings={(list ?? []).map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setForm(null)}
          onSubmit={async (v: ContactValues) => {
            const body = { ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val.trim()])), reportsToId: v.reportsToId || null };
            try {
              await run(() =>
                form === "new"
                  ? api(`/leads/${leadId}/contacts`, { method: "POST", body, companyId })
                  : api(`/contacts/${form.id}`, { method: "PATCH", body, companyId }),
              );
              setForm(null);
            } catch {
              /* l'erreur est affichée au-dessus ; la fenêtre reste ouverte pour corriger */
            }
          }}
        />
      )}
    </div>
  );
}

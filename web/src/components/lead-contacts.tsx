"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, describeError } from "@/lib/api";
import type { Contact } from "@/lib/activity";
import { useSession } from "@/lib/session";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice, TextArea } from "./ui";

const EMPTY = { name: "", role: "", phone: "", whatsapp: "", email: "", notes: "" };

function ContactForm({ contact, onClose, onSubmit }: { contact?: Contact; onClose: () => void; onSubmit: (v: typeof EMPTY) => Promise<void> }) {
  const [v, setV] = useState(contact ? { name: contact.name, role: contact.role, phone: contact.phone, whatsapp: contact.whatsapp, email: contact.email, notes: contact.notes } : EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(v);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={contact ? "Modifier le contact" : "Nouveau contact"} onClose={onClose} width="max-w-[520px]">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nom" value={v.name} onChange={set("name")} required maxLength={100} />
        <Field label="Fonction" value={v.role} onChange={set("role")} maxLength={100} placeholder="Gérant, comptable…" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone" value={v.phone} onChange={set("phone")} maxLength={40} />
          <Field label="WhatsApp" value={v.whatsapp} onChange={set("whatsapp")} maxLength={40} placeholder="+229…" />
        </div>
        <Field label="E-mail" type="email" value={v.email} onChange={set("email")} maxLength={200} />
        <TextArea label="Notes" value={v.notes} onChange={set("notes")} maxLength={1000} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" className="w-auto" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="w-auto" loading={busy}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Les personnes à contacter dans l'entreprise ; une seule est « principale » et donne son nom au lead. */
export function LeadContacts({ leadId, canWrite, onChanged }: { leadId: string; canWrite: boolean; onChanged: () => void }) {
  const { companyId } = useSession();
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
                {canWrite && (
                  <div className="flex shrink-0 gap-1">
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
          onClose={() => setForm(null)}
          onSubmit={async (v) => {
            const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val.trim()]));
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

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, describeError } from "@/lib/api";
import { TEMPLATE_VARIABLES, type Template } from "@/lib/messages";
import { useSession } from "@/lib/session";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice, Select, TextArea } from "./ui";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
];

function TemplateForm({ template, onClose, onSaved }: { template?: Template; onClose: () => void; onSaved: () => void }) {
  const { companyId } = useSession();
  const [name, setName] = useState(template?.name ?? "");
  const [channel, setChannel] = useState<string>(template?.channel ?? "whatsapp");
  const [body, setBody] = useState(template?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { name: name.trim(), channel, body: body.trim() };
      if (template) await api(`/templates/${template.id}`, { method: "PATCH", body: payload, companyId });
      else await api("/templates", { method: "POST", body: payload, companyId });
      onSaved();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={template ? "Modifier le modèle" : "Nouveau modèle"} onClose={onClose} width="max-w-[560px]">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Premier contact" autoFocus />
        <Select label="Canal" value={channel} onChange={(e) => setChannel(e.target.value)} options={CHANNELS} />
        <TextArea label="Message" rows={6} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={2000} placeholder="Bonjour {{contact}}, je suis {{moi}}…" />
        <p className="text-small text-muted">
          Variables : {TEMPLATE_VARIABLES.map((v) => (
            <button key={v.token} type="button" title={v.label} onClick={() => setBody((b) => `${b}${v.token}`)} className="mr-2 font-mono text-link underline decoration-dotted underline-offset-4">
              {v.token}
            </button>
          ))}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" className="w-auto" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="w-auto" loading={busy} disabled={!name.trim() || !body.trim()}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Modèles de messages de l'entreprise : tout le monde les utilise, ceux qui ont le droit les gèrent. */
export function TemplatesPage() {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const [list, setList] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Template | "new" | null>(null);

  const load = useCallback(
    () => api<Template[]>("/templates", { companyId }).then(setList).catch((e) => setError(describeError(e))),
    [companyId],
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold">Modèles de messages</h1>
          <p className="text-small text-muted">Des textes prêts à envoyer depuis la fiche d’un lead ou la page Contacts.</p>
        </div>
        {perms.includes("template:create") && (
          <Button className="h-9 w-auto" onClick={() => setForm("new")}>
            <PlusIcon size={16} /> Nouveau modèle
          </Button>
        )}
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {list === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucun modèle pour l’instant.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.name}</p>
                  <span className="inline-flex h-[22px] items-center rounded-md bg-forest-soft px-[9px] text-small font-bold text-forest">{t.channel === "email" ? "E-mail" : "WhatsApp"}</span>
                </div>
                {perms.includes("template:update") && (
                  <button type="button" aria-label={`Modifier ${t.name}`} onClick={() => setForm(t)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
                    <PencilIcon size={15} />
                  </button>
                )}
                {perms.includes("template:delete") && (
                  <button
                    type="button"
                    aria-label={`Supprimer ${t.name}`}
                    onClick={() => window.confirm(`Supprimer le modèle « ${t.name} » ?`) && api(`/templates/${t.id}`, { method: "DELETE", companyId }).then(load).catch((e) => setError(describeError(e)))}
                    className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail"
                  >
                    <TrashIcon size={15} />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-small text-muted">{t.body}</p>
            </li>
          ))}
        </ul>
      )}
      {form && (
        <TemplateForm
          template={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

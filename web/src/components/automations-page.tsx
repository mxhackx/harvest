"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { KIND_LABEL, describeRule, type Automation } from "@/lib/automations";
import { useSession } from "@/lib/session";
import { PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice, Select, TextArea } from "./ui";

/** Automatisations : répartir les nouveaux leads à tour de rôle, relancer par une tâche ou un e-mail quand rien ne se passe. */
export function AutomationsPage() {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const [list, setList] = useState<Automation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => api<Automation[]>("/automations", { companyId }).then(setList).catch((e) => setError(describeError(e))), [companyId]);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (a: Automation) => {
    await api(`/automations/${a.id}`, { method: "PATCH", companyId, body: { active: !a.active } }).catch((e) => setError(describeError(e)));
    await load();
  };
  const remove = async (a: Automation) => {
    if (!window.confirm(`Supprimer l’automatisation « ${a.name} » ?`)) return;
    await api(`/automations/${a.id}`, { method: "DELETE", companyId }).catch((e) => setError(describeError(e)));
    await load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Automatisations</h1>
          <p className="text-small text-muted">Des règles qui travaillent seules : répartir les nouveaux leads, relancer ceux qui restent sans suite.</p>
        </div>
        {perms.includes("automation:create") && (
          <Button className="h-9 w-auto" onClick={() => setCreating(true)}>
            <PlusIcon size={16} /> Nouvelle règle
          </Button>
        )}
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {list === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucune règle pour l’instant.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.name} <span className="ml-2 rounded-md border border-border px-2 text-small font-medium">{KIND_LABEL[a.kind]}</span></p>
                <p className="text-small text-muted">{describeRule(a)}</p>
                <p className="text-small text-muted">{a.done} lead{a.done > 1 ? "s" : ""} traité{a.done > 1 ? "s" : ""}</p>
              </div>
              {perms.includes("automation:update") && (
                <label className="flex items-center gap-2 text-small">
                  <input type="checkbox" className="size-4 accent-accent" checked={a.active} onChange={() => toggle(a)} aria-label={`Activer ${a.name}`} />
                  {a.active ? "Active" : "En pause"}
                </label>
              )}
              {perms.includes("automation:delete") && (
                <button type="button" aria-label={`Supprimer ${a.name}`} onClick={() => remove(a)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                  <TrashIcon size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {creating && <CreateRule onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function CreateRule({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { companyId } = useSession();
  const [kind, setKind] = useState<Automation["kind"]>("assign");
  const [name, setName] = useState("");
  const [members, setMembers] = useState<{ userId: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [title, setTitle] = useState("Relancer {{entreprise}}");
  const [days, setDays] = useState("3");
  const [subject, setSubject] = useState("Suite à notre échange");
  const [text, setText] = useState("Bonjour {{contact}},\n\nJe reviens vers vous au sujet de {{entreprise}}. Avez-vous eu le temps d'y réfléchir ?\n\nCordialement");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ userId: string; name: string }[]>("/members", { companyId }).then(setMembers).catch(() => {});
  }, [companyId]);

  const save = async () => {
    const afterDays = Math.floor(Number(days));
    const params = kind === "assign" ? { userIds: chosen } : kind === "task" ? { title: title.trim(), afterDays, priority: "normal" } : { subject: subject.trim(), body: text.trim(), afterDays };
    setBusy(true);
    try {
      await api("/automations", { companyId, body: { kind, name: name.trim(), params } });
      onCreated();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };
  return (
    <Modal title="Nouvelle règle" onClose={onClose} width="max-w-[540px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Nom de la règle" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Select label="Que doit-elle faire ?" value={kind} onChange={(e) => setKind(e.target.value as Automation["kind"])} options={(Object.keys(KIND_LABEL) as Automation["kind"][]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
        {kind === "assign" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-small font-semibold">Confier à tour de rôle à…</legend>
            {members.map((m) => (
              <label key={m.userId} className="flex items-center gap-2 text-body">
                <input type="checkbox" className="size-4 accent-accent" checked={chosen.includes(m.userId)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, m.userId] : c.filter((x) => x !== m.userId)))} />
                {m.name}
              </label>
            ))}
          </fieldset>
        )}
        {kind !== "assign" && <Field label="Combien de jours après la création du lead ?" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="font-mono" />}
        {kind === "task" && <Field label="Titre de la tâche" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}
        {kind === "email" && (
          <>
            <Field label="Objet" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
            <TextArea label="Message ({{contact}} et {{entreprise}} sont remplacés)" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
            <p className="text-small text-muted">L’e-mail part au contact principal du lead, avec votre adresse en « répondre à ». N’activez cette règle que si vos contacts ont accepté d’être relancés.</p>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>Annuler</Button>
          <Button className="sm:w-auto" loading={busy} disabled={!name.trim() || (kind === "assign" && chosen.length === 0)} onClick={save}>Créer</Button>
        </div>
      </div>
    </Modal>
  );
}

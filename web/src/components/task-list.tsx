"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, describeError } from "@/lib/api";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { dueLabel, groupOpenTasks, localInputToIso, taskState, type Task } from "@/lib/tasks";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice, Select } from "./ui";

type Member = { userId: string; name: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Création et modification d'une tâche. Le choix de la personne n'apparaît que si l'on a le droit d'attribuer. */
export function TaskModal({ task, leadId, defaultDay, onClose, onSaved }: { task?: Task; leadId?: string; /** jour proposé pour l'échéance à la création (9 h) */ defaultDay?: Date; onClose: () => void; onSaved: () => void }) {
  const { me, companyId } = useSession();
  const { leads } = useLeads();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const canAssign = perms.includes("task:assign") && perms.includes("member:read");
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState(task?.title ?? "");
  const [due, setDue] = useState(toLocalInput(task?.dueAt ?? (defaultDay ? new Date(defaultDay.getFullYear(), defaultDay.getMonth(), defaultDay.getDate(), 9).toISOString() : null)));
  const [lead, setLead] = useState(task?.leadId ?? leadId ?? "");
  const [assignee, setAssignee] = useState(task?.ownerId ?? me.user.id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canAssign) return;
    api<Member[]>("/members", { companyId }).then(setMembers).catch(() => {});
  }, [canAssign, companyId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = { title: title.trim(), dueAt: localInputToIso(due), leadId: lead || null, ...(canAssign ? { assigneeId: assignee } : {}) };
    try {
      if (task) await api(`/tasks/${task.id}`, { method: "PATCH", body, companyId });
      else await api("/tasks", { method: "POST", body, companyId });
      onSaved();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={task ? "Modifier la tâche" : "Nouvelle tâche"} onClose={onClose} width="max-w-[520px]">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Quoi faire" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="Ex. : rappeler pour le devis" autoFocus />
        <Field label="Échéance" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        {!leadId && (
          <Select
            label="Lead concerné"
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            options={[{ value: "", label: "Aucun" }, ...(leads ?? []).map((l) => ({ value: l.id, label: l.name }))]}
          />
        )}
        {canAssign && members.length > 0 && (
          <Select label="Attribuée à" value={assignee} onChange={(e) => setAssignee(e.target.value)} options={members.map((m) => ({ value: m.userId, label: m.userId === me.user.id ? `${m.name} (moi)` : m.name }))} />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" className="w-auto" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="w-auto" loading={busy} disabled={!title.trim()}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

const TONE: Record<string, string> = { overdue: "text-fail font-medium", today: "text-accent-press font-medium", upcoming: "text-muted", none: "text-muted", done: "text-muted" };

/** Une tâche : case à cocher, texte, lead, personne, échéance ; actions si l'on a les droits. */
function TaskRow({ task, showLead, showAssignee, canEdit, onChanged, onEdit, onError }: { task: Task; showLead: boolean; showAssignee: boolean; canEdit: boolean; onChanged: () => void; onEdit: () => void; onError: (m: string) => void }) {
  const { companyId } = useSession();
  const state = taskState(task);
  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      onChanged();
    } catch (e) {
      onError(describeError(e));
    }
  }
  return (
    <li className="flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={state === "done"}
        disabled={!canEdit}
        onChange={(e) => run(() => api(`/tasks/${task.id}`, { method: "PATCH", body: { done: e.target.checked }, companyId }))}
        aria-label={state === "done" ? `Rouvrir : ${task.title}` : `Terminer : ${task.title}`}
        className="mt-1 size-4 shrink-0 accent-accent"
      />
      <div className="min-w-0 flex-1">
        <p className={`break-words text-body ${state === "done" ? "text-muted line-through" : ""}`}>{task.title}</p>
        <p className="flex flex-wrap gap-x-3 text-small text-muted">
          <span className={TONE[state]}>{dueLabel(task)}</span>
          {showLead && task.leadId && task.leadName && (
            <Link href={`/leads/${task.leadId}`} className="hover:underline">{task.leadName}</Link>
          )}
          {showAssignee && <span>{task.assigneeName}</span>}
        </p>
      </div>
      {canEdit && (
        <div className="flex shrink-0 gap-1">
          <button type="button" aria-label={`Modifier ${task.title}`} onClick={onEdit} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
            <PencilIcon size={15} />
          </button>
          <button type="button" aria-label={`Supprimer ${task.title}`} onClick={() => run(() => api(`/tasks/${task.id}`, { method: "DELETE", companyId }))} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
            <TrashIcon size={15} />
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Liste de tâches : ouvertes groupées par urgence, ou terminées. `leadId` restreint à un lead (fiche) :
 * la colonne lead disparaît et la création est préremplie.
 */
export function TaskList({ leadId, filter = "open", allowCreate = true, onChanged }: { leadId?: string; filter?: "open" | "done"; allowCreate?: boolean; onChanged?: () => void }) {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const canEdit = perms.includes("task:update");
  const canCreate = allowCreate && perms.includes("task:create");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Task | "new" | null>(null);
  const [tick, setTick] = useState(0);

  const query = `?status=${filter}${leadId ? `&leadId=${leadId}` : ""}`;
  useEffect(() => {
    let live = true;
    api<Task[]>(`/tasks${query}`, { companyId })
      .then((t) => live && setTasks(t))
      .catch((e) => live && setError(describeError(e)));
    return () => {
      live = false;
    };
  }, [query, companyId, tick]);

  const changed = () => {
    setTick((n) => n + 1);
    onChanged?.();
  };
  const mixed = tasks?.some((t) => t.ownerId !== me.user.id) ?? false;
  const row = (t: Task) => <TaskRow key={t.id} task={t} showLead={!leadId} showAssignee={mixed} canEdit={canEdit} onChanged={changed} onEdit={() => setModal(t)} onError={setError} />;

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {canCreate && (
        <Button variant="secondary" className="h-9 w-auto self-start" onClick={() => setModal("new")}>
          <PlusIcon size={16} /> Nouvelle tâche
        </Button>
      )}
      {tasks === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : tasks.length === 0 ? (
        <p className="text-small text-muted">{filter === "open" ? "Rien à faire pour l’instant." : "Aucune tâche terminée."}</p>
      ) : filter === "open" ? (
        groupOpenTasks(tasks).map((g) => (
          <section key={g.key} aria-label={g.label}>
            <h3 className={`mb-1 text-small font-semibold uppercase tracking-wide ${g.key === "overdue" ? "text-fail" : "text-muted"}`}>
              {g.label} · {g.tasks.length}
            </h3>
            <ul className="divide-y divide-rule">{g.tasks.map(row)}</ul>
          </section>
        ))
      ) : (
        <ul className="divide-y divide-rule">{tasks.map(row)}</ul>
      )}
      {modal && (
        <TaskModal
          task={modal === "new" ? undefined : modal}
          leadId={leadId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            changed();
          }}
        />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { useCrumb } from "@/lib/crumb";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";
import type { Graph, Workflow, WorkflowSummary } from "@/lib/workflows";
import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { Button, Notice } from "../ui";
import { WorkflowEditor } from "./editor";

/** Page des workflows : la liste à gauche, l'éditeur du workflow ouvert à droite. */
export function WorkflowsPage() {
  const { me, companyId } = useSession();
  const router = useRouter();
  const { id } = useParams<{ id?: string }>();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const [list, setList] = useState<WorkflowSummary[] | null>(null);
  const [open, setOpen] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fail = useCallback((e: unknown) => setError(describeError(e)), []);
  useCrumb(open && open.id === id ? open.name : null);

  const load = useCallback(() => api<WorkflowSummary[]>("/workflows", { companyId }).then(setList).catch(fail), [companyId, fail]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (id) api<Workflow>(`/workflows/${id}`, { companyId }).then(setOpen).catch(fail);
  }, [id, companyId, fail]);

  const create = async () => {
    const used = new Set(list?.map((w) => w.name));
    let n = 1;
    while (used.has(`Workflow ${n}`)) n++;
    try {
      const w = await api<Workflow>("/workflows", { companyId, body: { name: `Workflow ${n}` } });
      await load();
      router.push(ROUTES.workflow(w.id));
    } catch (e) {
      fail(e);
    }
  };
  const rename = async (w: WorkflowSummary) => {
    const name = window.prompt("Nom du workflow", w.name)?.trim();
    if (!name || name === w.name) return;
    try {
      await api(`/workflows/${w.id}`, { method: "PATCH", companyId, body: { name: name.slice(0, 80) } });
      // seul le nom change : le dessin en cours d'édition n'est pas rechargé
      setOpen((o) => (o?.id === w.id ? { ...o, name } : o));
      await load();
    } catch (e) {
      fail(e);
    }
  };
  const remove = async (w: WorkflowSummary) => {
    if (!window.confirm(`Supprimer le workflow « ${w.name} » ?`)) return;
    try {
      await api(`/workflows/${w.id}`, { method: "DELETE", companyId });
      await load();
      if (w.id === id) router.push(ROUTES.workflows);
    } catch (e) {
      fail(e);
    }
  };
  const save = async (graph: Graph) => {
    setSaving(true);
    setError(null);
    try {
      await api(`/workflows/${id}`, { method: "PATCH", companyId, body: { graph } });
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const small = "flex size-7 shrink-0 items-center justify-center rounded-micro text-muted hover:bg-card hover:text-ink";
  return (
    <div className="-m-6 -mb-24 flex flex-col md:-mb-6 lg:h-[calc(100dvh-3.5rem)] lg:flex-row">
      <nav aria-label="Workflows" className="flex w-56 shrink-0 flex-col gap-2 border-r border-rule bg-card p-3 max-lg:w-full max-lg:border-b max-lg:border-r-0">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-semibold">Workflows</h1>
          {perms.includes("workflow:create") && (
            <button type="button" aria-label="Nouveau workflow" title="Nouveau workflow" onClick={create} className={small}>
              <PlusIcon size={16} />
            </button>
          )}
        </div>
        <ul className="flex flex-col gap-1 overflow-y-auto max-lg:max-h-40">
          {list?.map((w) => (
            <li key={w.id} className={`flex items-center gap-1 rounded-control pr-1 ${w.id === id ? "bg-accent-soft" : "hover:bg-field"}`}>
              <Link href={ROUTES.workflow(w.id)} aria-current={w.id === id ? "page" : undefined} className="min-w-0 flex-1 truncate px-2 py-2 text-body">{w.name}</Link>
              {w.id === id && perms.includes("workflow:update") && <button type="button" aria-label={`Renommer ${w.name}`} onClick={() => rename(w)} className={small}><PencilIcon size={14} /></button>}
              {w.id === id && perms.includes("workflow:delete") && <button type="button" aria-label={`Supprimer ${w.name}`} onClick={() => remove(w)} className={small}><TrashIcon size={14} /></button>}
            </li>
          ))}
        </ul>
        {list?.length === 0 && <p className="text-small text-muted">Aucun workflow pour l’instant.</p>}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        {error && <div className="p-3"><Notice onClose={() => setError(null)}>{error}</Notice></div>}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {id && open?.id === id ? (
            <WorkflowEditor key={open.id} workflow={open} editable={perms.includes("workflow:update")} saving={saving} onSave={save} />
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div className="flex max-w-sm flex-col items-center gap-3">
                <p className="text-small text-muted">{id ? "Chargement…" : "Choisissez un workflow, ou créez-en un : un déclencheur, puis des étapes à la suite."}</p>
                {!id && perms.includes("workflow:create") && <Button className="h-9 w-auto" onClick={create}><PlusIcon size={16} /> Nouveau workflow</Button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

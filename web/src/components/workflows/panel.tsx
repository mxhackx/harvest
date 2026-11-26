"use client";

import { AGENT_ACTIONS, AUTONOMY, BLOCKS, INPUT_TYPES, OPERATORS, TRIGGERS, type AgentAction, type Config, type NodeType, type StartInput, type WorkflowNode } from "@/lib/workflows";
import { PlusIcon, TrashIcon } from "../icons";
import { Field, Select, TextArea } from "../ui";

export const DRAG_TYPE = "application/x-workflow-block";
const options = (record: Record<string, string>) => Object.entries(record).map(([value, label]) => ({ value, label }));

/** Onglet « Blocs » : cliquer ajoute au bout de la chaîne, glisser pose le bloc où l'on veut. */
export function Toolbox({ editable, onAdd }: { editable: boolean; onAdd: (type: NodeType) => void }) {
  return (
    <ul className="flex flex-col gap-2 p-3">
      {(Object.keys(BLOCKS) as NodeType[]).filter((t) => t !== "start").map((t) => (
        <li key={t}>
          <button type="button" draggable={editable} disabled={!editable} onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, t)} onClick={() => onAdd(t)} className="flex w-full items-center gap-3 rounded-control border border-border bg-card px-3 py-2 text-left hover:bg-field disabled:opacity-50">
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: `var(${BLOCKS[t].token})` }} />
            <span className="min-w-0">
              <span className="block font-medium">{BLOCKS[t].label}</span>
              <span className="block text-small text-muted">{BLOCKS[t].hint}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Onglet « Éditeur » : les réglages du bloc sélectionné. */
export function BlockEditor({ block, editable, onChange }: { block: WorkflowNode | null; editable: boolean; onChange: (patch: Partial<WorkflowNode>) => void }) {
  if (!block) return <p className="p-4 text-small text-muted">Sélectionnez un bloc sur le canevas pour le régler.</p>;
  const c = block.config as Record<string, string>;
  const set = (patch: Config) => onChange({ config: { ...block.config, ...patch } });
  const field = (key: string, label: string, max: number) => <Field label={label} value={c[key]} maxLength={max} onChange={(e) => set({ [key]: e.target.value })} />;
  const area = (key: string, label: string, max: number) => <TextArea label={label} rows={5} value={c[key]} maxLength={max} onChange={(e) => set({ [key]: e.target.value })} />;
  const number = (key: string, label: string, min: number, max: number) => (
    <Field label={label} type="number" min={min} max={max} value={c[key]} onChange={(e) => set({ [key]: Math.min(max, Math.max(min, Math.floor(Number(e.target.value)) || min)) })} />
  );
  const action = AGENT_ACTIONS[c.action as AgentAction];
  return (
    <fieldset disabled={!editable || block.locked} className="flex min-w-0 flex-col gap-4 p-4">
      {block.locked && <p className="text-small text-muted">Bloc verrouillé : déverrouillez-le pour le modifier.</p>}
      <Field label="Nom du bloc" value={block.label} maxLength={60} onChange={(e) => onChange({ label: e.target.value })} />
      {block.type === "start" && (
        <>
          <Select label="Déclencheur" value={c.trigger} options={options(TRIGGERS)} onChange={(e) => set({ trigger: e.target.value })} />
          <Inputs value={block.config.inputs as StartInput[]} onChange={(inputs) => set({ inputs })} />
        </>
      )}
      {block.type === "agent" && (
        <>
          <Select
            label="Action"
            value={c.action}
            options={Object.entries(AGENT_ACTIONS).map(([value, a]) => ({ value, label: a.label }))}
            onChange={(e) => set({ action: e.target.value, autonomy: AGENT_ACTIONS[e.target.value as AgentAction].initial })}
          />
          {area("instruction", "Consigne", 4000)}
          <Select label="Autonomie" value={String(c.autonomy)} options={AUTONOMY.slice(0, action.max).map((label, i) => ({ value: String(i + 1), label: `${i + 1}. ${label}` }))} onChange={(e) => set({ autonomy: Number(e.target.value) })} />
          {action.max < 4 && <p className="text-small text-muted">Action sensible : une personne doit toujours valider.</p>}
        </>
      )}
      {block.type === "task" && (
        <>
          {field("title", "Titre de la tâche", 120)}
          {number("afterDays", "Échéance (jours)", 0, 365)}
        </>
      )}
      {block.type === "email" && (
        <>
          {field("subject", "Objet", 200)}
          {area("body", "Message", 4000)}
        </>
      )}
      {block.type === "condition" && (
        <>
          {field("field", "Champ à tester", 60)}
          <Select label="Comparaison" value={c.operator} options={options(OPERATORS)} onChange={(e) => set({ operator: e.target.value })} />
          {c.operator !== "filled" && field("value", "Valeur", 200)}
        </>
      )}
      {block.type === "approval" && (
        <>
          {area("message", "Ce qu'il faut valider", 500)}
          {number("timeoutHours", "Délai de réponse (heures)", 1, 720)}
        </>
      )}
    </fieldset>
  );
}

function Inputs({ value, onChange }: { value: StartInput[]; onChange: (inputs: StartInput[]) => void }) {
  const patch = (i: number, p: Partial<StartInput>) => onChange(value.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small font-semibold">Entrées</p>
      {value.map((x, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-control border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-small font-medium">Entrée {i + 1}</p>
            <button type="button" aria-label={`Supprimer l'entrée ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex size-7 items-center justify-center rounded-micro text-muted hover:bg-field hover:text-fail">
              <TrashIcon size={14} />
            </button>
          </div>
          <Field label="Nom" value={x.name} maxLength={60} placeholder="prenom" onChange={(e) => patch(i, { name: e.target.value })} />
          <Select label="Type" value={x.type} options={options(INPUT_TYPES)} onChange={(e) => patch(i, { type: e.target.value as StartInput["type"] })} />
          <Field label="Description" value={x.description} maxLength={200} onChange={(e) => patch(i, { description: e.target.value })} />
          <Field label="Valeur par défaut" value={x.value} maxLength={500} onChange={(e) => patch(i, { value: e.target.value })} />
        </div>
      ))}
      {value.length < 20 && (
        <button type="button" onClick={() => onChange([...value, { name: "", type: "string", description: "", value: "" }])} className="flex h-9 items-center justify-center gap-2 rounded-control border border-frame text-small font-medium hover:bg-field">
          <PlusIcon size={14} /> Ajouter une entrée
        </button>
      )}
    </div>
  );
}

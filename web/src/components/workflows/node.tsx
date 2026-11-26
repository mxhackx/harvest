"use client";

import { Handle, NodeToolbar, Position, type Node, type NodeProps } from "@xyflow/react";
import { createContext, useContext } from "react";
import { BLOCKS, summary, type WorkflowNode } from "@/lib/workflows";
import { CopyIcon, LockIcon, PowerIcon, TrashIcon } from "../icons";

export type BlockData = { block: WorkflowNode };
export type BlockActions = { editable: boolean; patch: (id: string, patch: Partial<WorkflowNode>) => void; remove: (id: string) => void; duplicate: (id: string) => void };
export const Actions = createContext<BlockActions>({ editable: false, patch: () => {}, remove: () => {}, duplicate: () => {} });

/** Carte d'un bloc sur le canevas, avec sa petite barre d'outils quand il est sélectionné. */
export function BlockNode({ data, selected }: NodeProps<Node<BlockData>>) {
  const { block } = data;
  const { editable, patch, remove, duplicate } = useContext(Actions);
  const start = block.type === "start";
  const tool = (label: string, onClick: () => void, icon: React.ReactNode, pressed?: boolean, disabled?: boolean) => (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} className={`flex size-7 items-center justify-center rounded-micro hover:bg-card disabled:opacity-40 ${pressed ? "text-accent-press" : "text-muted"}`}>
      {icon}
    </button>
  );
  return (
    <>
      <NodeToolbar isVisible={selected && editable} position={Position.Top} offset={6}>
        <div className="flex gap-1 rounded-control border border-frame bg-field p-1">
          {!start && tool(block.disabled ? "Activer" : "Désactiver", () => patch(block.id, { disabled: !block.disabled }), <PowerIcon size={15} />, block.disabled)}
          {tool(block.locked ? "Déverrouiller" : "Verrouiller", () => patch(block.id, { locked: !block.locked }), <LockIcon size={15} />, block.locked)}
          {!start && tool("Dupliquer", () => duplicate(block.id), <CopyIcon size={15} />)}
          {!start && tool("Supprimer", () => remove(block.id), <TrashIcon size={15} />, undefined, block.locked)}
        </div>
      </NodeToolbar>
      <div className={`w-60 rounded-card border bg-card px-3 py-2 ${selected ? "border-accent" : "border-frame"} ${block.disabled ? "opacity-50" : ""}`}>
        {!start && <Handle type="target" position={Position.Left} />}
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold">{block.label}</p>
          <span className="flex shrink-0 items-center gap-1 rounded-micro bg-field px-2 text-caption font-medium">
            <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${BLOCKS[block.type].token})` }} />
            {BLOCKS[block.type].label}
          </span>
        </div>
        <p className="truncate text-small text-muted">{summary(block)}</p>
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  );
}

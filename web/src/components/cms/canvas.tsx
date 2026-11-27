"use client";

/* Rendu d'un arbre de nœuds sur le canevas : sélection, écriture directe, glisser-déposer. Même CSS que l'export. */
/* eslint-disable @next/next/no-img-element */
import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import type { Node, Site } from "@/lib/cms/model";
import { styleOf } from "@/lib/cms/style";

export const DRAG_NODE = "application/x-cms-node";
export const DRAG_NEW = "application/x-cms-new";
export type Where = "before" | "after" | "inside";

/** Haut, milieu ou bas de la cible : avant, dedans (cadres seulement) ou après. */
export function whereFor(e: DragEvent, n: Node): Where {
  const box = e.currentTarget.getBoundingClientRect();
  const y = (e.clientY - box.top) / box.height;
  if (n.type === "frame") return y < 0.2 ? "before" : y > 0.8 ? "after" : "inside";
  return y < 0.5 ? "before" : "after";
}
export const isDrag = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_NODE) || e.dataTransfer.types.includes(DRAG_NEW);

export type CanvasActions = {
  selected: string | null;
  select: (id: string) => void;
  setText: (id: string, text: string) => void;
  dropOn: (e: DragEvent, targetId: string, where: Where) => void;
};

export function CanvasNode({ node: n, site, mobile, actions, root = false }: { node: Node; site: Site; mobile: boolean; actions: CanvasActions | null; root?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [over, setOver] = useState<Where | null>(null);
  if (n.hidden) return null;
  const style = styleOf(n, site, mobile) as CSSProperties;
  const selected = actions?.selected === n.id;

  const editor: Record<string, unknown> = actions
    ? {
        "data-node": n.type,
        draggable: !root && !editing,
        onClick: (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); actions.select(n.id); },
        onDoubleClick: (e: React.MouseEvent) => { if (n.type === "text" || n.type === "button") { e.stopPropagation(); setEditing(true); } },
        onDragStart: (e: DragEvent) => { e.stopPropagation(); e.dataTransfer.setData(DRAG_NODE, n.id); },
        onDragOver: (e: DragEvent) => { if (!isDrag(e)) return; e.preventDefault(); e.stopPropagation(); setOver(root ? "inside" : whereFor(e, n)); },
        onDragLeave: () => setOver(null),
        onDrop: (e: DragEvent) => { if (!isDrag(e)) return; e.preventDefault(); e.stopPropagation(); setOver(null); actions.dropOn(e, n.id, root ? "inside" : whereFor(e, n)); },
      }
    : {};
  const marks: CSSProperties = actions
    ? {
        outline: selected ? "2px solid var(--color-accent)" : over === "inside" ? "2px dashed var(--color-accent)" : undefined,
        outlineOffset: -2,
        ...(over === "before" ? { boxShadow: "0 -3px 0 var(--color-accent)" } : over === "after" ? { boxShadow: "0 3px 0 var(--color-accent)" } : {}),
        cursor: editing ? "text" : "default",
      }
    : {};
  const props = { ...editor, style: { ...style, ...marks } };

  if (n.type === "text" || n.type === "button") {
    const Tag = (n.type === "button" ? "a" : n.textStyle === "h1" ? "h1" : n.textStyle === "h2" ? "h2" : "p") as "p";
    return (
      <Tag
        key={String(editing)}
        {...props}
        contentEditable={editing}
        suppressContentEditableWarning
        ref={(el: HTMLElement | null) => { if (editing && el && document.activeElement !== el) el.focus(); }}
        onBlur={(e: React.FocusEvent<HTMLElement>) => { if (!editing) return; setEditing(false); actions?.setText(n.id, e.currentTarget.innerText.trim()); }}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => { if (editing && (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey))) { e.preventDefault(); e.currentTarget.blur(); } }}
      >
        {n.text}
      </Tag>
    );
  }
  if (n.type === "image")
    return n.src ? <img {...props} src={n.src} alt={n.alt ?? ""} /> : <div {...props} style={{ ...props.style, display: "grid", placeItems: "center", border: "1px dashed currentColor", opacity: 0.5, fontSize: 12 }}>{n.name}</div>;
  const field: CSSProperties = { border: "1px solid currentColor", borderRadius: 10, padding: "12px 14px", opacity: 0.7 };
  const children: ReactNode =
    n.type === "form" ? (
      <>
        <span style={field}>Votre nom</span>
        <span style={field}>Téléphone ou e-mail</span>
        <span style={{ ...field, minHeight: 90 }}>Votre message</span>
        <span style={{ ...field, background: "var(--accent)", color: "var(--fond)", borderColor: "var(--accent)", textAlign: "center", opacity: 1, fontWeight: 600 }}>{n.text}</span>
      </>
    ) : (
      (n.children ?? []).map((c) => <CanvasNode key={c.id} node={c} site={site} mobile={mobile} actions={actions} />)
    );
  const emptyHint = actions && n.type === "frame" && !n.children?.length;
  return (
    <div {...props} style={{ ...props.style, ...(emptyHint ? { minHeight: 64, border: "1px dashed currentColor" } : {}) }}>
      {children}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { ELEMENTS, SECTIONS, TYPE_LABEL, addPage, checkSite, drop, duplicate, find, insert, move, place, remove, slug, update, type Node, type NodeType, type Page, type Site } from "@/lib/cms/model";
import { exportProject } from "@/lib/cms/export";
import { rootVariables } from "@/lib/cms/style";
import { zip } from "@/lib/cms/zip";
import { ChevronIcon, CopyIcon, DownloadIcon, PowerIcon, RedoIcon, TrashIcon, UndoIcon } from "../icons";
import { CanvasNode, DRAG_NEW, DRAG_NODE, isDrag, whereFor, type CanvasActions, type Where } from "./canvas";
import { NodeFields, PageFields, StyleFields } from "./inspector";

const DEVICES = { mobile: 390, tablet: 768, desktop: 1180 };
const DEVICE_LABEL = { mobile: "Mobile", tablet: "Tablette", desktop: "Bureau" };
const icon = "flex size-8 shrink-0 items-center justify-center rounded-control text-muted hover:bg-field hover:text-ink disabled:opacity-30";
const tab = (on: boolean) => `h-8 rounded-control px-3 text-small font-medium ${on ? "bg-field text-ink" : "text-muted hover:text-ink"}`;
const heading = "flex items-center justify-between px-3 pt-3 text-caption font-semibold uppercase text-muted";

/** Élément à créer, décrit par ce qu'on a glissé ou cliqué : « element:text » ou « section:hero ». */
const make = (what: string, siteName: string): Node | null => {
  const [kind, id] = what.split(":");
  if (kind === "element" && id in ELEMENTS) return ELEMENTS[id as NodeType]();
  return kind === "section" && id in SECTIONS ? SECTIONS[id].build(siteName) : null;
};

type Props = { site: Site; onChange: (site: Site) => void; onBack: () => void; saved: boolean };

/** Éditeur de site, organisé comme Figma : pages et calques à gauche, canevas au centre, propriétés à droite. */
export function Studio({ site, onChange, onBack, saved }: Props) {
  // `key` : des frappes successives dans le même champ ne font qu'une étape d'annulation
  const [history, setHistory] = useState<{ past: Site[]; future: Site[]; key: string }>({ past: [], future: [], key: "" });
  const [pageId, setPageId] = useState(site.pages[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [left, setLeft] = useState<"layers" | "insert">("layers");
  const [right, setRight] = useState<"design" | "styles" | "checks">("design");
  const [device, setDevice] = useState<keyof typeof DEVICES>("mobile");
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);

  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];
  const root = page.root;
  const node = selected ? find(root, selected) : null;
  const mobile = device === "mobile";

  const commit = useCallback((next: Site, key = "") => {
    if (next === site) return;
    setHistory((h) => ({ past: key !== "" && key === h.key ? h.past : [...h.past.slice(-49), site], future: [], key }));
    onChange({ ...next, updatedAt: new Date().toISOString() });
  }, [site, onChange]);
  const undo = useCallback(() => {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [site, ...history.future], key: "" });
    onChange(previous);
  }, [history, site, onChange]);
  const redo = useCallback(() => {
    const [next, ...rest] = history.future;
    if (!next) return;
    setHistory({ past: [...history.past, site], future: rest, key: "" });
    onChange(next);
  }, [history, site, onChange]);

  const setPage = (patch: Partial<Page>, key = "") => commit({ ...site, pages: site.pages.map((p) => (p.id === page.id ? { ...p, ...patch } : p)) }, key);
  const setRoot = (next: Node, key = "") => { if (next !== root) setPage({ root: next }, key); };

  const add = (what: string) => {
    const added = make(what, site.name);
    if (!added) return;
    setRoot(insert(root, what.startsWith("section:") ? null : selected, added));
    setSelected(added.id);
    setRight("design");
  };
  const dropOn = (e: DragEvent, targetId: string, where: Where) => {
    const moved = e.dataTransfer.getData(DRAG_NODE);
    if (moved) return setRoot(drop(root, moved, targetId, where));
    const added = make(e.dataTransfer.getData(DRAG_NEW), site.name);
    if (!added) return;
    setRoot(place(root, targetId, where, added));
    setSelected(added.id);
  };
  const actions: CanvasActions = { selected, select: (id) => { setSelected(id); setRight("design"); }, setText: (id, text) => setRoot(update(root, id, { text })), dropOn };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (e.key === "Escape" && !typing) { setPreview(false); setSelected(null); }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Ctrl + molette : zoom du canevas plutôt que de la page (écouteur non passif obligatoire)
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(2, Math.max(0.25, z - Math.sign(e.deltaY) * 0.1)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const download = () => {
    const url = URL.createObjectURL(new Blob([zip(exportProject(site))], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(site.name) || "site"}-next.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const checks = checkSite(site);
  const failed = checks.filter((c) => !c.ok).length;
  const frame = (editable: boolean) => (
    <div style={{ ...rootVariables(site), width: DEVICES[device], background: "var(--fond)", color: "var(--texte)", fontFamily: "system-ui, sans-serif", minHeight: 480 }} className="overflow-hidden">
      <CanvasNode node={root} site={site} mobile={mobile} actions={editable ? actions : null} root />
    </div>
  );

  const layer = (n: Node, depth: number) => (
    <li key={n.id}>
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData(DRAG_NODE, n.id)}
        onDragOver={(e) => { if (isDrag(e)) e.preventDefault(); }}
        onDrop={(e) => { if (!isDrag(e)) return; e.preventDefault(); dropOn(e, n.id, whereFor(e, n)); }}
        className={`group flex items-center rounded-control ${selected === n.id ? "bg-accent-soft" : "hover:bg-field"}`}
        style={{ paddingLeft: depth * 12 }}
      >
        <button type="button" onClick={() => actions.select(n.id)} className={`min-w-0 flex-1 truncate px-2 py-1.5 text-left text-small ${n.hidden ? "text-muted line-through" : ""}`}>
          {n.type === "text" || n.type === "button" ? n.text || n.name : n.name}
          <span className="ml-2 text-micro text-muted">{TYPE_LABEL[n.type]}</span>
        </button>
        <span className="hidden group-focus-within:flex group-hover:flex">
          <button type="button" aria-label={`Monter ${n.name}`} onClick={() => setRoot(move(root, n.id, -1))} className={`${icon} size-6`}><span className="rotate-180"><ChevronIcon size={12} /></span></button>
          <button type="button" aria-label={`Descendre ${n.name}`} onClick={() => setRoot(move(root, n.id, 1))} className={`${icon} size-6`}><ChevronIcon size={12} /></button>
          <button type="button" aria-label={`${n.hidden ? "Afficher" : "Masquer"} ${n.name}`} onClick={() => setRoot(update(root, n.id, { hidden: !n.hidden }))} className={`${icon} size-6`}><PowerIcon size={12} /></button>
          <button type="button" aria-label={`Dupliquer ${n.name}`} onClick={() => setRoot(duplicate(root, n.id))} className={`${icon} size-6`}><CopyIcon size={12} /></button>
          <button type="button" aria-label={`Supprimer ${n.name}`} onClick={() => setRoot(remove(root, n.id))} className={`${icon} size-6`}><TrashIcon size={12} /></button>
        </span>
      </div>
      {n.children && n.children.length > 0 && <ul>{n.children.map((c) => layer(c, depth + 1))}</ul>}
    </li>
  );
  const palette = (what: string, label: string) => (
    <li key={what}>
      <button type="button" draggable onDragStart={(e) => e.dataTransfer.setData(DRAG_NEW, what)} onClick={() => add(what)} className="flex h-9 w-full cursor-grab items-center rounded-control border border-border px-2 text-left text-small hover:bg-field">+ {label}</button>
    </li>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-card">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-rule px-3">
        <button type="button" aria-label="Retour à mes sites" onClick={onBack} className={icon}><span className="rotate-90"><ChevronIcon /></span></button>
        <input aria-label="Nom du site" value={site.name} maxLength={60} onChange={(e) => commit({ ...site, name: e.target.value }, "name")} className="h-8 w-40 rounded-control border border-transparent bg-transparent px-2 text-small font-semibold hover:border-border focus:border-accent" />
        <span className={`truncate text-caption ${saved ? "text-muted" : "text-fail"}`}>{saved ? "Enregistré sur cet appareil" : "Non enregistré : stockage plein"}</span>
        <div role="group" aria-label="Taille d’écran" className="mx-auto flex gap-1">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={tab(device === d)}>{DEVICE_LABEL[d]}</button>)}
        </div>
        <button type="button" aria-label="Annuler" title="Annuler (Ctrl+Z)" onClick={undo} disabled={!history.past.length} className={icon}><UndoIcon size={16} /></button>
        <button type="button" aria-label="Rétablir" title="Rétablir (Ctrl+Maj+Z)" onClick={redo} disabled={!history.future.length} className={icon}><RedoIcon size={16} /></button>
        <button type="button" onClick={() => setPreview(true)} className="h-8 rounded-control border border-frame px-3 text-small font-medium hover:bg-field">Aperçu</button>
        <button type="button" onClick={download} className="flex h-8 items-center gap-2 rounded-control bg-accent px-3 text-small font-medium text-white hover:bg-accent-hover"><DownloadIcon size={14} /> Exporter le code</button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside aria-label="Structure" className="flex w-64 shrink-0 flex-col border-r border-rule max-md:hidden">
          <div className={heading}>
            Pages
            <button type="button" aria-label="Ajouter une page" className={`${icon} size-6`} onClick={() => { const name = window.prompt("Nom de la page")?.trim(); if (!name) return; const next = addPage(site, name.slice(0, 60)); commit(next); setPageId(next.pages.at(-1)!.id); setSelected(null); }}>+</button>
          </div>
          <ul aria-label="Pages" className="border-b border-rule p-2">
            {site.pages.map((p) => (
              <li key={p.id} className={`flex items-center rounded-control ${p.id === page.id ? "bg-field font-semibold" : "hover:bg-field"}`}>
                <button type="button" onClick={() => { setPageId(p.id); setSelected(null); }} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-small">{p.name}</button>
                {p.path !== "" && <button type="button" aria-label={`Supprimer la page ${p.name}`} className={`${icon} size-6`} onClick={() => window.confirm(`Supprimer la page « ${p.name} » ?`) && commit({ ...site, pages: site.pages.filter((x) => x.id !== p.id) })}><TrashIcon size={12} /></button>}
              </li>
            ))}
          </ul>
          <div role="tablist" className="flex gap-1 border-b border-rule p-2">
            <button type="button" role="tab" aria-selected={left === "layers"} onClick={() => setLeft("layers")} className={tab(left === "layers")}>Calques</button>
            <button type="button" role="tab" aria-selected={left === "insert"} onClick={() => setLeft("insert")} className={tab(left === "insert")}>Ajouter</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {left === "layers" ? (
              <ul aria-label="Calques">{(root.children ?? []).map((c) => layer(c, 0))}</ul>
            ) : (
              <>
                <p className="px-1 pb-1 text-caption font-semibold uppercase text-muted">Éléments</p>
                <ul className="flex flex-col gap-1">{(Object.keys(ELEMENTS) as NodeType[]).map((t) => palette(`element:${t}`, TYPE_LABEL[t]))}</ul>
                <p className="px-1 pb-1 pt-3 text-caption font-semibold uppercase text-muted">Blocs prêts</p>
                <ul className="flex flex-col gap-1">{Object.entries(SECTIONS).map(([id, s]) => palette(`section:${id}`, s.label))}</ul>
              </>
            )}
          </div>
        </aside>

        <div className="relative min-w-0 flex-1">
          <div ref={canvas} className="studio-canvas absolute inset-0 overflow-auto p-10" onClick={() => setSelected(null)}>
            <div className="mx-auto w-max" style={{ zoom }}>
              <p className="mb-2 text-caption text-muted">{page.name} · {DEVICE_LABEL[device]} {DEVICES[device]} px</p>
              <div className="border border-frame">{frame(true)}</div>
            </div>
          </div>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-card border border-frame bg-card p-1">
            <button type="button" aria-label="Dézoomer" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className={icon}>−</button>
            <button type="button" onClick={() => setZoom(1)} title="Revenir à 100 %" className="h-8 w-14 rounded-control font-mono text-caption hover:bg-field">{Math.round(zoom * 100)} %</button>
            <button type="button" aria-label="Zoomer" onClick={() => setZoom((z) => Math.min(2, z + 0.25))} className={icon}>+</button>
          </div>
        </div>

        <aside aria-label="Propriétés" className="flex w-72 shrink-0 flex-col border-l border-rule">
          <div role="tablist" className="flex gap-1 border-b border-rule p-2">
            {([["design", "Design"], ["styles", "Styles"], ["checks", `Contrôles${failed ? ` (${failed})` : ""}`]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={right === k} onClick={() => setRight(k)} className={tab(right === k)}>{label}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {right === "styles" ? (
              <StyleFields site={site} onChange={(patch) => commit({ ...site, ...patch }, `styles:${Object.keys(patch)}`)} />
            ) : right === "checks" ? (
              <ul aria-live="polite" className="p-3 font-mono text-small">
                {checks.map((c) => (
                  <li key={c.code}>
                    <button type="button" disabled={c.ok || !c.nodeId} onClick={() => { setPageId(c.pageId!); setSelected(c.nodeId!); setRight("design"); }} className="w-full py-1 text-left enabled:hover:bg-field">
                      <span className={c.ok ? "text-forest" : "text-fail"}>[{c.ok ? "OK" : "KO"}]</span> {c.code} {c.text}
                    </button>
                  </li>
                ))}
              </ul>
            ) : node ? (
              <NodeFields key={node.id} node={node} site={site} isRoot={node === root} onChange={(patch) => setRoot(update(root, node.id, patch), `${node.id}:${Object.keys(patch)}:${Object.keys(patch.props ?? {})}`)} />
            ) : (
              <>
                <PageFields key={page.id} page={page} onChange={(patch) => setPage(patch, `page:${page.id}`)} />
                <NodeFields node={root} site={site} isRoot onChange={(patch) => setRoot(update(root, root.id, patch), `${root.id}:props`)} />
              </>
            )}
          </div>
        </aside>
      </div>

      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Aperçu du site" className="fixed inset-0 z-50 overflow-auto bg-scrim p-6">
          <button type="button" autoFocus onClick={() => setPreview(false)} className="fixed right-4 top-4 h-9 rounded-control border border-frame bg-card px-3 text-small font-medium">Fermer l’aperçu</button>
          <div className="mx-auto w-max">{frame(false)}</div>
        </div>
      )}
    </div>
  );
}

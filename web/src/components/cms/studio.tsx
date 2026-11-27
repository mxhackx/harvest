"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BLOCK_LABEL, checkSite, moveBlock, newBlock, newId, type Block, type BlockType, type Site } from "@/lib/cms/site";
import { ChevronIcon, CopyIcon, PowerIcon, RedoIcon, TrashIcon, UndoIcon } from "../icons";
import { BlockFields, ThemeFields } from "./inspector";
import { BlockView, themeStyle } from "./preview";

const DEVICES = { mobile: 390, tablet: 768, desktop: 1180 };
const DEVICE_LABEL = { mobile: "Mobile", tablet: "Tablette", desktop: "Bureau" };
const icon = "flex size-8 items-center justify-center rounded-control text-muted hover:bg-field hover:text-ink disabled:opacity-30";
const tab = (on: boolean) => `h-8 rounded-control px-3 text-small font-medium ${on ? "bg-field text-ink" : "text-muted hover:text-ink"}`;

type Props = { site: Site; onChange: (site: Site) => void; onBack: () => void; saved: boolean };

/** Éditeur de site, organisé comme Figma : calques à gauche, canevas au centre, propriétés à droite. */
export function Studio({ site, onChange, onBack, saved }: Props) {
  // `key` : des frappes successives dans le même champ ne font qu'une étape d'annulation
  const [history, setHistory] = useState<{ past: Site[]; future: Site[]; key: string }>({ past: [], future: [], key: "" });
  const [selected, setSelected] = useState<string | null>(site.blocks[0]?.id ?? null);
  const [left, setLeft] = useState<"layers" | "insert">("layers");
  const [right, setRight] = useState<"content" | "theme" | "checks">("content");
  const [device, setDevice] = useState<keyof typeof DEVICES>("mobile");
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setPreview(false);
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

  const block = site.blocks.find((b) => b.id === selected) ?? null;
  const patch = (id: string, p: Partial<Block>) => commit({ ...site, blocks: site.blocks.map((b) => (b.id === id ? { ...b, ...p } : b)) }, `${id}:${Object.keys(p)}`);
  const add = (type: BlockType) => {
    const b = newBlock(type);
    commit({ ...site, blocks: [...site.blocks, b] });
    setSelected(b.id);
    setRight("content");
    setLeft("layers");
  };
  const duplicate = (b: Block) => {
    const copy = { ...structuredClone(b), id: newId() };
    const i = site.blocks.findIndex((x) => x.id === b.id);
    commit({ ...site, blocks: [...site.blocks.slice(0, i + 1), copy, ...site.blocks.slice(i + 1)] });
    setSelected(copy.id);
  };
  const remove = (id: string) => commit({ ...site, blocks: site.blocks.filter((b) => b.id !== id) });
  const checks = checkSite(site);
  const failed = checks.filter((c) => !c.ok).length;

  const frame = (editable: boolean): ReactNode => (
    <div style={{ ...themeStyle(site.theme), width: DEVICES[device] }} className="overflow-hidden">
      {site.blocks.filter((b) => !b.hidden).map((b) =>
        editable ? (
          <div key={b.id} data-block={b.type} className={`relative outline-2 -outline-offset-2 ${selected === b.id ? "outline-accent" : "outline-transparent hover:outline-accent/50"}`}>
            {selected === b.id && <span className="absolute left-0 top-0 bg-accent px-2 py-0.5 font-sans text-micro font-semibold text-white">{BLOCK_LABEL[b.type]}</span>}
            <button type="button" aria-label={`Sélectionner : ${BLOCK_LABEL[b.type]}`} className="absolute inset-0 z-10" onClick={() => { setSelected(b.id); setRight("content"); }} />
            <BlockView block={b} />
          </div>
        ) : (
          <BlockView key={b.id} block={b} />
        ),
      )}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-card">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-rule px-3">
        <button type="button" aria-label="Retour à mes sites" onClick={onBack} className={icon}><span className="rotate-90"><ChevronIcon /></span></button>
        <input aria-label="Nom du site" value={site.name} maxLength={60} onChange={(e) => commit({ ...site, name: e.target.value }, "name")} className="h-8 w-44 rounded-control border border-transparent bg-transparent px-2 text-small font-semibold hover:border-border focus:border-accent" />
        <span className={`text-caption ${saved ? "text-muted" : "text-fail"}`}>{saved ? "Enregistré sur cet appareil" : "Non enregistré : stockage plein"}</span>
        <div role="group" aria-label="Taille d’écran" className="mx-auto flex gap-1">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={tab(device === d)}>{DEVICE_LABEL[d]}</button>)}
        </div>
        <button type="button" aria-label="Annuler" title="Annuler (Ctrl+Z)" onClick={undo} disabled={!history.past.length} className={icon}><UndoIcon size={16} /></button>
        <button type="button" aria-label="Rétablir" title="Rétablir (Ctrl+Maj+Z)" onClick={redo} disabled={!history.future.length} className={icon}><RedoIcon size={16} /></button>
        <button type="button" onClick={() => setPreview(true)} className="h-8 rounded-control border border-frame px-3 text-small font-medium hover:bg-field">Aperçu</button>
        <button type="button" disabled title="La publication n’est pas encore construite" className="h-8 rounded-control bg-accent px-3 text-small font-medium text-white opacity-50">Publier</button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside aria-label="Structure" className="flex w-60 shrink-0 flex-col border-r border-rule max-md:hidden">
          <div role="tablist" className="flex gap-1 border-b border-rule p-2">
            <button type="button" role="tab" aria-selected={left === "layers"} onClick={() => setLeft("layers")} className={tab(left === "layers")}>Calques</button>
            <button type="button" role="tab" aria-selected={left === "insert"} onClick={() => setLeft("insert")} className={tab(left === "insert")}>Ajouter</button>
          </div>
          <ul aria-label={left === "layers" ? "Calques" : "Blocs disponibles"} className="flex-1 overflow-y-auto p-2">
            {left === "insert"
              ? (Object.keys(BLOCK_LABEL) as BlockType[]).map((t) => (
                  <li key={t}><button type="button" onClick={() => add(t)} className="flex h-10 w-full items-center rounded-control border border-transparent px-2 text-left text-small hover:border-frame">+ {BLOCK_LABEL[t]}</button></li>
                ))
              : site.blocks.map((b, i) => (
                  <li key={b.id} className={`group flex items-center rounded-control ${selected === b.id ? "bg-accent-soft" : "hover:bg-field"}`}>
                    <button type="button" onClick={() => { setSelected(b.id); setRight("content"); }} className={`min-w-0 flex-1 truncate px-2 py-2 text-left text-small ${b.hidden ? "text-muted line-through" : ""}`}>{BLOCK_LABEL[b.type]}</button>
                    <span className="hidden group-focus-within:flex group-hover:flex">
                      <button type="button" aria-label={`Monter ${BLOCK_LABEL[b.type]}`} disabled={i === 0} onClick={() => commit(moveBlock(site, b.id, -1))} className={`${icon} size-6`}><span className="rotate-180"><ChevronIcon size={12} /></span></button>
                      <button type="button" aria-label={`Descendre ${BLOCK_LABEL[b.type]}`} disabled={i === site.blocks.length - 1} onClick={() => commit(moveBlock(site, b.id, 1))} className={`${icon} size-6`}><ChevronIcon size={12} /></button>
                      <button type="button" aria-label={`${b.hidden ? "Afficher" : "Masquer"} ${BLOCK_LABEL[b.type]}`} onClick={() => patch(b.id, { hidden: !b.hidden })} className={`${icon} size-6`}><PowerIcon size={12} /></button>
                      <button type="button" aria-label={`Dupliquer ${BLOCK_LABEL[b.type]}`} onClick={() => duplicate(b)} className={`${icon} size-6`}><CopyIcon size={12} /></button>
                      <button type="button" aria-label={`Supprimer ${BLOCK_LABEL[b.type]}`} onClick={() => remove(b.id)} className={`${icon} size-6`}><TrashIcon size={12} /></button>
                    </span>
                  </li>
                ))}
          </ul>
        </aside>

        <div className="relative min-w-0 flex-1">
          <div ref={canvas} className="studio-canvas absolute inset-0 overflow-auto p-10">
            <div className="mx-auto w-max" style={{ zoom }}>
              <p className="mb-2 text-caption text-muted">{site.name} · {DEVICE_LABEL[device]} {DEVICES[device]} px</p>
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
            {([["content", "Contenu"], ["theme", "Thème"], ["checks", `Contrôles${failed ? ` (${failed})` : ""}`]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={right === k} onClick={() => setRight(k)} className={tab(right === k)}>{label}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {right === "theme" ? (
              <ThemeFields site={site} onChange={(theme) => commit({ ...site, theme }, "theme")} />
            ) : right === "checks" ? (
              <ul aria-live="polite" className="p-3 font-mono text-small">
                {checks.map((c) => (
                  <li key={c.code}>
                    <button type="button" disabled={c.ok || !c.blockId} onClick={() => { setSelected(c.blockId!); setRight("content"); }} className="w-full py-1 text-left enabled:hover:bg-field">
                      <span className={c.ok ? "text-forest" : "text-fail"}>[{c.ok ? "OK" : "KO"}]</span> {c.code} {c.text}
                    </button>
                  </li>
                ))}
              </ul>
            ) : block ? (
              <BlockFields key={block.id} block={block} onChange={(p) => patch(block.id, p)} />
            ) : (
              <p className="p-3 text-small text-muted">Sélectionnez un bloc sur le canevas.</p>
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

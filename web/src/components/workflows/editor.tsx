"use client";

import "@xyflow/react/dist/style.css";
import { Background, ReactFlow, ReactFlowProvider, useReactFlow, type Node, type NodeChange } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addNode, canConnect, check, removeNode, MAX_NODES, type CheckLine, type Graph, type NodeType, type Workflow, type WorkflowNode } from "@/lib/workflows";
import { ChevronIcon, ExpandIcon, RedoIcon, UndoIcon } from "../icons";
import { Button } from "../ui";
import { Actions, BlockNode, type BlockData } from "./node";
import { BlockEditor, DRAG_TYPE, Toolbox } from "./panel";

const nodeTypes = { block: BlockNode };
const newId = () => `n${crypto.randomUUID().slice(0, 8)}`;
type History = { past: Graph[]; present: Graph; future: Graph[] };
type Props = { workflow: Workflow; editable: boolean; saving: boolean; onSave: (graph: Graph) => Promise<boolean> };

export function WorkflowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({ workflow, editable, saving, onSave }: Props) {
  const flow = useReactFlow();
  const [history, setHistory] = useState<History>({ past: [], present: workflow.graph, future: [] });
  const [saved, setSaved] = useState(workflow.graph);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"blocks" | "editor">("editor");
  const [log, setLog] = useState<CheckLine[] | null>(null);
  const [logOpen, setLogOpen] = useState(true);
  const graph = history.present;
  const dirty = graph !== saved;
  // dernière saisie fusionnée : taper un mot ne fait qu'une seule étape d'annulation
  const typing = useRef("");

  const commit = useCallback((next: (g: Graph) => Graph, key = "") => {
    setHistory((h) => {
      const present = next(h.present);
      if (present === h.present) return h;
      const merge = key !== "" && key === typing.current;
      typing.current = key;
      return { past: merge ? h.past : [...h.past.slice(-49), h.present], present, future: [] };
    });
    setLog(null);
  }, []);
  const undo = () => {
    typing.current = "";
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h));
  };
  const redo = () => {
    typing.current = "";
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  };

  const patch = useCallback((id: string, p: Partial<WorkflowNode>, key = "") => commit((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) }), key), [commit]);
  const actions = useMemo(
    () => ({
      editable,
      patch,
      remove: (id: string) => commit((g) => removeNode(g, id)),
      duplicate: (id: string) =>
        commit((g) => {
          const n = g.nodes.find((x) => x.id === id);
          if (!n || g.nodes.length >= MAX_NODES) return g;
          return { ...g, nodes: [...g.nodes, { ...n, id: newId(), label: `${n.label.slice(0, 52)} (copie)`, locked: false, position: { x: n.position.x + 40, y: n.position.y + 100 } }] };
        }),
    }),
    [editable, patch, commit],
  );

  // tailles mesurées par React Flow : à conserver, sinon les liens ne se dessinent pas
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const nodes: Node<BlockData>[] = graph.nodes.map((n) => ({ id: n.id, type: "block", position: n.position, data: { block: n }, selected: n.id === selected, draggable: editable && !n.locked, measured: sizes[n.id] }));
  const [edgeSel, setEdgeSel] = useState<string | null>(null);
  const edges = graph.edges.map((e) => ({ id: `${e.source}-${e.target}`, source: e.source, target: e.target, selected: edgeSel === `${e.source}-${e.target}` }));

  const dragging = useRef(false);
  const onNodesChange = (changes: NodeChange<Node<BlockData>>[]) => {
    for (const c of changes) {
      if (c.type === "dimensions" && c.dimensions) setSizes((s) => ({ ...s, [c.id]: c.dimensions! }));
      if (c.type === "select") {
        if (c.selected) {
          setSelected(c.id);
          setTab("editor");
        } else setSelected((s) => (s === c.id ? null : s));
      }
      if (c.type === "position" && c.position) {
        // tout un glissement compte pour une seule annulation
        patch(c.id, { position: c.position }, `move:${c.id}`);
        if (!c.dragging && dragging.current) typing.current = "";
        dragging.current = !!c.dragging;
      }
    }
  };

  const add = (type: NodeType, position?: { x: number; y: number }) => {
    const id = newId();
    commit((g) => addNode(g, type, id, position));
    setSelected(id);
    setTab("editor");
    // le nouveau bloc doit rester visible
    if (!position) setTimeout(() => flow.fitView({ maxZoom: 1, duration: 200 }), 50);
  };

  const save = async () => {
    const sent = graph;
    if (await onSave(sent)) setSaved(sent);
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const block = graph.nodes.find((n) => n.id === selected) ?? null;
  const failed = log?.filter((l) => !l.ok).length ?? 0;

  return (
    <Actions.Provider value={actions}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="workflow-canvas relative min-h-[360px] flex-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const type = e.dataTransfer.getData(DRAG_TYPE) as NodeType;
            if (!type || !editable) return;
            e.preventDefault();
            add(type, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={(changes) => {
              for (const c of changes) if (c.type === "select") setEdgeSel((s) => (c.selected ? c.id : s === c.id ? null : s));
              const gone = changes.filter((c) => c.type === "remove").map((c) => c.id);
              if (gone.length && editable) commit((g) => ({ ...g, edges: g.edges.filter((e) => !gone.includes(`${e.source}-${e.target}`)) }));
            }}
            onConnect={(c) => commit((g) => (canConnect(g, c.source, c.target) ? { ...g, edges: [...g.edges, { source: c.source, target: c.target }] } : g))}
            isValidConnection={(c) => canConnect(graph, c.source, c.target)}
            nodesConnectable={editable}
            // la suppression d'un bloc passe par sa barre d'outils, qui recoud la chaîne ; la touche Suppr retire un lien
            deleteKeyCode={["Delete", "Backspace"]}
            onBeforeDelete={async ({ edges: gone }) => (editable ? { nodes: [], edges: gone.filter((e) => e.selected) } : false)}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={24} />
          </ReactFlow>
          <div className="absolute bottom-3 left-3 flex gap-1 rounded-control border border-frame bg-card p-1">
            <Tool label="Annuler" onClick={undo} disabled={!editable || history.past.length === 0}><UndoIcon size={16} /></Tool>
            <Tool label="Rétablir" onClick={redo} disabled={!editable || history.future.length === 0}><RedoIcon size={16} /></Tool>
            <Tool label="Tout voir" onClick={() => flow.fitView({ maxZoom: 1, duration: 200 })}><ExpandIcon size={16} /></Tool>
          </div>
        </div>
        <section aria-label="Journal" className="border-t border-rule bg-card">
          <button type="button" aria-expanded={logOpen} onClick={() => setLogOpen((o) => !o)} className="flex h-10 w-full items-center justify-between px-4 text-small font-semibold">
            <span>Journal{log && ` · ${failed ? `${failed} à corriger` : "tout est prêt"}`}</span>
            <span className={logOpen ? "" : "rotate-180"}><ChevronIcon /></span>
          </button>
          {logOpen && (
            <div className="h-36 overflow-y-auto px-4 pb-3 font-mono text-small" aria-live="polite">
              {!log ? (
                <p className="text-muted">Aucun contrôle pour l’instant : lancez « Vérifier ».</p>
              ) : (
                log.map((l, i) => (
                  <button key={i} type="button" disabled={!l.nodeId} onClick={() => { setSelected(l.nodeId!); setTab("editor"); }} className="block w-full text-left hover:bg-field">
                    <span className={l.ok ? "text-forest" : "text-fail"}>[{l.ok ? "OK" : "KO"}]</span> {l.text}
                  </button>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      <aside aria-label="Réglages" className="flex w-80 shrink-0 flex-col border-l border-rule bg-card max-lg:w-full max-lg:border-l-0 max-lg:border-t">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-rule p-3">
          {!editable && <p className="mr-auto text-small text-muted">Lecture seule</p>}
          <Button variant="secondary" className="h-9 w-auto" onClick={() => { setLog(check(graph)); setLogOpen(true); }}>Vérifier</Button>
          {editable && <Button className="h-9 w-auto" loading={saving} disabled={!dirty} onClick={save}>{dirty ? "Enregistrer" : "Enregistré"}</Button>}
        </div>
        <div role="tablist" className="flex gap-1 border-b border-rule p-2">
          {([["blocks", "Blocs"], ["editor", "Éditeur"]] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`h-8 rounded-control px-3 text-small font-medium ${tab === key ? "bg-accent-soft text-accent-press" : "text-muted hover:bg-field"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "blocks" ? (
            <Toolbox editable={editable} onAdd={(t) => add(t)} />
          ) : (
            <BlockEditor key={block?.id} block={block} editable={editable} onChange={(p) => block && patch(block.id, p, `edit:${block.id}:${Object.keys(p)}`)} />
          )}
        </div>
      </aside>
    </Actions.Provider>
  );
}

function Tool({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="flex size-8 items-center justify-center rounded-control text-muted hover:bg-field hover:text-ink disabled:opacity-40">
      {children}
    </button>
  );
}

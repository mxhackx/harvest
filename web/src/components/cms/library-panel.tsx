"use client";

import { useEffect, useState } from "react";
import { REGISTRY_URL, fetchCatalog, type Component } from "@/lib/cms/library";
import { DRAG_NEW } from "./canvas";

/** Catalogue du registre, chargé une fois par visite. */
export function useCatalog() {
  const [state, setState] = useState<{ items: Component[]; error: boolean; loading: boolean }>({ items: [], error: false, loading: true });
  useEffect(() => {
    let live = true;
    fetchCatalog().then(
      (items) => live && setState({ items, error: false, loading: false }),
      () => live && setState({ items: [], error: true, loading: false }),
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** Onglet « Composants » : cliquer ou glisser pose une COPIE dans la page. */
export function LibraryPanel({ catalog, onAdd }: { catalog: ReturnType<typeof useCatalog>; onAdd: (what: string) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = catalog.items.filter((c) => !q || `${c.title} ${c.category} ${c.description}`.toLowerCase().includes(q));
  if (catalog.loading) return <p className="p-1 text-small text-muted">Chargement…</p>;
  if (catalog.error) return <p className="p-1 text-small text-muted">Registre de composants injoignable ({REGISTRY_URL}).</p>;
  return (
    <>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" aria-label="Rechercher un composant" className="mb-2 h-8 w-full rounded-micro border border-border bg-field px-2 text-small" />
      {[...new Set(shown.map((c) => c.category))].map((category) => (
        <div key={category}>
          <p className="px-1 pb-1 pt-2 text-caption font-semibold uppercase text-muted">{category}</p>
          <ul className="flex flex-col gap-1">
            {shown.filter((c) => c.category === category).map((c) => (
              <li key={c.name}>
                <button type="button" draggable title={c.description} onDragStart={(e) => e.dataTransfer.setData(DRAG_NEW, `component:${c.name}`)} onClick={() => onAdd(`component:${c.name}`)} className="flex h-9 w-full cursor-grab items-center rounded-control border border-border px-2 text-left text-small hover:bg-field">
                  + {c.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <a href={REGISTRY_URL} target="_blank" rel="noopener noreferrer" className="mt-3 block px-1 text-small text-link underline">Ouvrir la marketplace</a>
    </>
  );
}

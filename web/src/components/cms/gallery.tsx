"use client";

import { useMemo, useState } from "react";
import { REGISTRY_URL, parseNode, type Component } from "@/lib/cms/library";
import type { Site } from "@/lib/cms/model";
import { rootVariables } from "@/lib/cms/style";
import { CanvasNode } from "./canvas";
import type { useCatalog } from "./library-panel";

/** L'aperçu est dessiné par le même moteur que le canevas, avec les couleurs et les styles de `site`. */
export function Preview({ component, site, small = false }: { component: Component; site: Site; small?: boolean }) {
  const node = useMemo(() => parseNode(component.node), [component]);
  return (
    // des « span » : l'aperçu peut se trouver dans un bouton
    <span aria-hidden className={`pointer-events-none flex select-none flex-col justify-center overflow-hidden ${small ? "h-24 w-full rounded-micro border border-rule p-2" : "h-52 border-b border-rule p-4"}`} style={{ ...rootVariables(site), background: "var(--fond)", color: "var(--texte)", fontFamily: "system-ui, sans-serif" }}>
      <span className="block text-left" style={{ zoom: small ? 0.42 : 0.72 }}>{node && <CanvasNode node={node} site={site} mobile={false} actions={null} />}</span>
    </span>
  );
}

const PAGE = 12;

type Props = { catalog: ReturnType<typeof useCatalog>; site: Site; addLabel: string; onAdd: (component: Component) => void };

/** Tous les composants du registre, avec leur aspect, une recherche et un filtre par catégorie. */
export function Gallery({ catalog, site, addLabel, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [count, setCount] = useState(PAGE);
  const q = query.trim().toLowerCase();
  if (catalog.loading) return <p className="text-small text-muted">Chargement des composants…</p>;
  if (catalog.error) return <p className="text-small text-muted">Registre de composants injoignable ({REGISTRY_URL}).</p>;
  const categories = [...new Set(catalog.items.map((c) => c.category))];
  const shown = catalog.items.filter((c) => (!category || c.category === category) && (!q || `${c.title} ${c.category} ${c.description}`.toLowerCase().includes(q)));
  const chip = (on: boolean) => `h-8 rounded-control border px-3 text-small font-medium ${on ? "border-accent bg-accent text-white" : "border-border bg-card hover:bg-field"}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setCount(PAGE); }} placeholder="Rechercher un composant" aria-label="Rechercher dans la galerie" className="h-8 w-60 rounded-control border border-border bg-card px-3 text-small" />
        <div role="group" aria-label="Catégories" className="flex flex-wrap gap-2">
          {["", ...categories].map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={() => { setCategory(c); setCount(PAGE); }} className={chip(category === c)}>{c || "Tout"}</button>)}
        </div>
        <span className="ml-auto text-small text-muted">{shown.length} composant{shown.length > 1 ? "s" : ""}</span>
      </div>
      <ul aria-label="Galerie de composants" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.slice(0, count).map((c) => (
          <li key={c.name} className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
            <Preview component={c} site={site} />
            <div className="flex flex-1 flex-col gap-1 p-3">
              <p className="font-semibold">{c.title}</p>
              <p className="text-caption text-muted">{c.category} · v{c.version}</p>
              <p className="text-small text-muted">{c.description}</p>
              <button type="button" onClick={() => onAdd(c)} aria-label={`${addLabel} : ${c.title}`} className="mt-auto h-8 self-start rounded-control bg-accent px-3 text-small font-medium text-white hover:bg-accent-hover">{addLabel}</button>
            </div>
          </li>
        ))}
      </ul>
      {shown.length > count && (
        <button type="button" onClick={() => setCount((n) => n + PAGE)} className="h-9 self-center rounded-control border border-frame bg-card px-5 text-small font-medium hover:bg-field">
          Charger plus ({shown.length - count} restant{shown.length - count > 1 ? "s" : ""})
        </button>
      )}
    </div>
  );
}

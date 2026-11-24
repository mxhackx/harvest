import type { Lead } from "./api";
import type { SegmentConfig } from "./segments";

/** Les leads d'une vue (onglet, recherche, filtres) puis triés : la même règle pour la page Leads et pour un segment. */
export function applyLeadView(leads: Lead[], c: SegmentConfig, meId: string): Lead[] {
  const q = c.query.trim().toLowerCase();
  const list = leads.filter((l) => {
    if (c.tab === "mine" && l.ownerId !== meId) return false;
    if (c.filters.mode !== "all" && l.visitMode !== c.filters.mode) return false;
    if (c.filters.visit === "visited" && !l.visitedAt) return false;
    if (c.filters.visit === "to_visit" && l.visitedAt) return false;
    const located = l.lat !== null && l.lng !== null;
    if (c.filters.position === "with" && !located) return false;
    if (c.filters.position === "without" && located) return false;
    if (c.filters.sector !== "all" && l.sector !== c.filters.sector) return false;
    if (q && ![l.name, l.sector, l.address, l.contactName, l.phone].some((v) => v.toLowerCase().includes(q))) return false;
    return true;
  });
  return list.sort((a, b) =>
    c.sort === "name" ? a.name.localeCompare(b.name, "fr") : c.sort === "value" ? (b.estimatedValue ?? -1) - (a.estimatedValue ?? -1) : b.createdAt.localeCompare(a.createdAt),
  );
}

const MODE = { all: "Tous les types", onsite: "À visiter en présentiel", remote: "Prospects simples (à distance)" } as const;
const VISIT = { all: "", to_visit: "Pas encore visités", visited: "Déjà visités" } as const;
const POSITION = { all: "", with: "Avec une position", without: "Sans position" } as const;

/** Les critères d'un segment en phrases courtes (« Pas encore visités », « Secteur : Santé »…), pour les afficher. */
export function describeFilters(c: SegmentConfig): string[] {
  return [
    c.tab === "mine" ? "Mes leads" : "",
    c.filters.mode !== "all" ? MODE[c.filters.mode] : "",
    VISIT[c.filters.visit],
    POSITION[c.filters.position],
    c.filters.sector !== "all" ? `Secteur : ${c.filters.sector}` : "",
    c.query.trim() ? `Contient « ${c.query.trim()} »` : "",
  ].filter(Boolean);
}

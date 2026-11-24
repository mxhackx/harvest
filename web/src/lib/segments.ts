export type SegmentConfig = {
  tab: "all" | "mine";
  query: string;
  sort: "recent" | "name" | "value";
  filters: { mode: "all" | "onsite" | "remote"; visit: "all" | "to_visit" | "visited"; position: "all" | "with" | "without"; sector: string };
};
export type Segment = { id: string; name: string; description: string; config: SegmentConfig; createdAt: string };

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Une vue enregistrée peut venir d'une ancienne version : toute valeur inconnue retombe sur le défaut, sans casser la page. */
export function sanitizeSegment(raw: unknown): SegmentConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f = (c.filters && typeof c.filters === "object" ? c.filters : {}) as Record<string, unknown>;
  return {
    tab: pick(c.tab, ["all", "mine"], "all"),
    query: typeof c.query === "string" ? c.query.slice(0, 100) : "",
    sort: pick(c.sort, ["recent", "name", "value"], "recent"),
    filters: {
      mode: pick(f.mode, ["all", "onsite", "remote"], "all"),
      visit: pick(f.visit, ["all", "to_visit", "visited"], "all"),
      position: pick(f.position, ["all", "with", "without"], "all"),
      sector: typeof f.sector === "string" && f.sector ? f.sector.slice(0, 100) : "all",
    },
  };
}

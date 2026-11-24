export type Region = { id: string; name: string; lat: number; lng: number; radiusKm: number; leadCount?: number };
export type WavePhase = "planned" | "active" | "overdue" | "closed";
export type WaveStats = { total: number; visited: number; converted: number; toRevisit: number; targetVisits: number };
export type Wave = {
  id: string;
  regionId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  targetVisits: number;
  closedAt: string | null;
  phase: WavePhase;
  region: Region | null;
  stats: WaveStats;
};
export type LeadBrief = { id: string; name: string; city: string; phone: string };

export const PHASE_LABEL: Record<WavePhase, string> = { planned: "À venir", active: "En cours", overdue: "En retard", closed: "Clôturée" };
/** Jeton de couleur de globals.css pour chaque phase (code couleur de la carte et des pastilles). */
export const PHASE_TOKEN: Record<WavePhase, string> = {
  planned: "--color-wave-planned",
  active: "--color-wave-active",
  overdue: "--color-wave-overdue",
  closed: "--color-wave-closed",
};

/** Avancement vers l'objectif de visites, de 0 à 100 ; null si la vague n'a pas d'objectif. */
export function progress(stats: Pick<WaveStats, "visited" | "targetVisits">): number | null {
  if (stats.targetVisits <= 0) return null;
  return Math.min(100, Math.round((stats.visited / stats.targetVisits) * 100));
}

const RANK: Record<WavePhase, number> = { active: 0, overdue: 1, planned: 2, closed: 3 };

/**
 * Phase qui colore une région sur la carte : la vague la plus « vivante » (en cours, puis en retard, puis à venir,
 * puis la dernière clôturée). null si la région n'a jamais eu de vague.
 */
export function regionPhase(waves: Pick<Wave, "regionId" | "phase" | "endsOn">[], regionId: string): WavePhase | null {
  const mine = waves.filter((w) => w.regionId === regionId);
  if (mine.length === 0) return null;
  return [...mine].sort((a, b) => RANK[a.phase] - RANK[b.phase] || b.endsOn.localeCompare(a.endsOn))[0].phase;
}

/** Anneau d'un cercle de `km` kilomètres autour d'un point, pour le dessiner sur la carte (GeoJSON, [lng, lat]). */
export function circlePolygon(lng: number, lat: number, km: number, steps = 64): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const parse = (d: string) => new Date(`${d}T12:00:00`);
export const formatPeriod = (startsOn: string, endsOn: string) => (startsOn === endsOn ? fmt.format(parse(startsOn)) : `${fmt.format(parse(startsOn))} – ${fmt.format(parse(endsOn))}`);

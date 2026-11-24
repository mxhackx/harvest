/**
 * Adresses de l'espace connecté, toutes sous /dashboard. Les écrire ici une seule fois évite d'oublier un lien
 * le jour où l'on déplace une page. Les pages publiques (/, /login, /docs…) restent hors de ce préfixe.
 */
export const DASHBOARD = "/dashboard";
/** Chaque module a son préfixe ; seul l'accueil (tableau de bord, calendrier) reste à la racine de /dashboard. */
const CRM = `${DASHBOARD}/crm`;
const ERP = `${DASHBOARD}/erp`;

export const ROUTES = {
  home: DASHBOARD,
  calendar: `${DASHBOARD}/calendrier`,
  leads: `${CRM}/leads`,
  lead: (id: string) => `${CRM}/leads/${id}`,
  contacts: `${CRM}/contacts`,
  tasks: `${CRM}/taches`,
  templates: `${CRM}/modeles`,
  pipeline: `${CRM}/pipeline`,
  reports: `${CRM}/rapports`,
  team: `${ERP}/equipe`,
} as const;

/**
 * Réécrit une ancienne adresse de l'espace connecté vers la nouvelle (sans /crm, ou avant /dashboard).
 * Sert aux adresses épinglées déjà enregistrées dans le navigateur. Les adresses à jour passent telles quelles.
 */
export function currentPath(path: string): string {
  return path.replace(/^(?:\/dashboard)?\/(leads|contacts|taches|modeles|pipeline|rapports)(?=\/|$)/, `${CRM}/$1`)
    .replace(/^(?:\/dashboard)?\/equipe(?=\/|$)/, `${ERP}/equipe`);
}

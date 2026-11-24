/**
 * Adresses de l'espace connecté, toutes sous /dashboard. Les écrire ici une seule fois évite d'oublier un lien
 * le jour où l'on déplace une page. Les pages publiques (/, /login, /docs…) restent hors de ce préfixe.
 */
export const DASHBOARD = "/dashboard";

export const ROUTES = {
  home: DASHBOARD,
  calendar: `${DASHBOARD}/calendrier`,
  leads: `${DASHBOARD}/leads`,
  lead: (id: string) => `${DASHBOARD}/leads/${id}`,
  contacts: `${DASHBOARD}/contacts`,
  tasks: `${DASHBOARD}/taches`,
  templates: `${DASHBOARD}/modeles`,
  pipeline: `${DASHBOARD}/pipeline`,
  reports: `${DASHBOARD}/rapports`,
  team: `${DASHBOARD}/equipe`,
} as const;

/**
 * Adresses de l'espace connecté, toutes sous /dashboard. Les écrire ici une seule fois évite d'oublier un lien
 * le jour où l'on déplace une page. Les pages publiques (/, /login, /docs…) restent hors de ce préfixe.
 */
export const DASHBOARD = "/dashboard";
/** Chaque module a son préfixe (crm, erp, waves) ; seul l'accueil (tableau de bord, calendrier) reste à la racine de /dashboard. */
const CRM = `${DASHBOARD}/crm`;
const ERP = `${DASHBOARD}/erp`;
const WAVES = `${DASHBOARD}/waves`;

export const ROUTES = {
  home: DASHBOARD,
  calendar: `${DASHBOARD}/calendar`,
  leads: `${CRM}/leads`,
  lead: (id: string) => `${CRM}/leads/${id}`,
  contacts: `${CRM}/contacts`,
  tasks: `${CRM}/tasks`,
  templates: `${CRM}/templates`,
  pipeline: `${CRM}/pipeline`,
  reports: `${CRM}/reports`,
  trash: `${CRM}/trash`,
  duplicates: `${CRM}/duplicates`,
  objectives: `${CRM}/objectives`,
  fields: `${CRM}/fields`,
  team: `${ERP}/team`,
  audit: `${ERP}/audit`,
  waves: WAVES,
  regions: `${WAVES}/regions`,
  map: `${WAVES}/map`,
} as const;

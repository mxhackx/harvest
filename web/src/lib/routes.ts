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
  invoices: `${CRM}/invoices`,
  invoice: (id: string) => `${CRM}/invoices/${id}`,
  segments: `${CRM}/segments`,
  segment: (id: string) => `${CRM}/segments/${id}`,
  fields: `${CRM}/fields`,
  quote: (id: string) => `${CRM}/quotes/${id}`,
  accounts: `${CRM}/accounts`,
  account: (id: string) => `${CRM}/accounts/${id}`,
  team: `${ERP}/team`,
  audit: `${ERP}/audit`,
  webhooks: `${ERP}/webhooks`,
  waves: WAVES,
  regions: `${WAVES}/regions`,
  tours: `${WAVES}/tours`,
  map: `${WAVES}/map`,
} as const;

/**
 * Anciennes adresses du site (noms français, avant /dashboard, avant /crm et /erp) et leur adresse actuelle.
 * Sert aux redirections de next.config.ts et à la mise à jour des pages épinglées dans le navigateur.
 * Un préfixe couvre aussi ses sous-pages (/dashboard/leads/42). Ne jamais y mettre /templates : c'est le dossier des fichiers modèles.
 */
export const LEGACY: ReadonlyArray<readonly [from: string, to: string]> = [
  // espace connecté : CRM
  ["/dashboard/crm/taches", "/dashboard/crm/tasks"],
  ["/dashboard/crm/modeles", "/dashboard/crm/templates"],
  ["/dashboard/crm/rapports", "/dashboard/crm/reports"],
  ...["leads", "contacts", "pipeline"].flatMap((p) => [
    [`/dashboard/${p}`, `/dashboard/crm/${p}`],
    [`/${p}`, `/dashboard/crm/${p}`],
  ] as const),
  ["/dashboard/taches", "/dashboard/crm/tasks"],
  ["/dashboard/modeles", "/dashboard/crm/templates"],
  ["/dashboard/rapports", "/dashboard/crm/reports"],
  ["/taches", "/dashboard/crm/tasks"],
  ["/modeles", "/dashboard/crm/templates"],
  ["/rapports", "/dashboard/crm/reports"],
  // espace connecté : ERP et accueil
  ["/dashboard/erp/equipe", "/dashboard/erp/team"],
  ["/dashboard/equipe", "/dashboard/erp/team"],
  ["/equipe", "/dashboard/erp/team"],
  ["/dashboard/calendrier", "/dashboard/calendar"],
  ["/calendrier", "/dashboard/calendar"],
  // connexion
  ["/mot-de-passe-oublie", "/forgot-password"],
  ["/reinitialiser", "/reset-password"],
  // documentation
  ["/docs/fiche-lead", "/docs/lead"],
  ["/docs/localisation", "/docs/location"],
  ["/docs/equipe", "/docs/team"],
  ["/docs/taches", "/docs/tasks"],
  ["/docs/rapports", "/docs/reports"],
  ["/docs/import/champs", "/docs/import/fields"],
  ["/docs/import/erreurs", "/docs/import/errors"],
];

/** Redirections permanentes pour next.config.ts (la sous-page et la requête sont conservées). */
export const legacyRedirects = () => LEGACY.map(([from, to]) => ({ source: `${from}/:rest*`, destination: `${to}/:rest*`, permanent: true }));

/** Adresse actuelle d'une adresse éventuellement ancienne ; les adresses à jour passent telles quelles. */
export function currentPath(path: string): string {
  for (const [from, to] of LEGACY) {
    if (path === from || path.startsWith(`${from}/`)) return to + path.slice(from.length);
  }
  return path;
}

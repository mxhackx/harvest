/**
 * Deux domaines pour un même site Next.js : la vitrine (hivation.tech) et l'application (app.hivation.tech).
 * Les deux pointent vers le même déploiement ; le proxy renvoie chaque page vers son domaine.
 * Sans NEXT_PUBLIC_APP_URL (développement, tests, prévisualisations), tout reste sur un seul domaine.
 */

/** Pages qui vivent sur le domaine de l'application. */
const APP_PREFIXES = ["/dashboard", "/login", "/invitation", "/forgot-password", "/reset-password", "/onboarding"];
/** Pages qui vivent sur le domaine de la vitrine (en plus de « / »). */
const SITE_PREFIXES = ["/docs"];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

const trim = (url: string) => url.replace(/\/$/, "");

/**
 * Adresse vers laquelle renvoyer la requête, ou null si la page est déjà sur le bon domaine.
 * `host` est l'en-tête Host de la requête ; les autres domaines (localhost, prévisualisation Vercel) ne sont jamais redirigés.
 */
export function hostRedirect(host: string, pathname: string, search: string, siteUrl: string, appUrl: string | undefined): string | null {
  if (!appUrl) return null;
  const site = trim(siteUrl);
  const app = trim(appUrl);
  const siteHost = new URL(site).host;
  const appHost = new URL(app).host;
  if (siteHost === appHost) return null;

  if (host === appHost) {
    if (pathname === "/") return `${app}/dashboard${search}`;
    if (SITE_PREFIXES.some((p) => under(pathname, p))) return `${site}${pathname}${search}`;
  }
  if (host === siteHost && APP_PREFIXES.some((p) => under(pathname, p))) return `${app}${pathname}${search}`;
  return null;
}

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ? trim(process.env.NEXT_PUBLIC_APP_URL) : "";
const SITE_ORIGIN = APP_ORIGIN && process.env.NEXT_PUBLIC_SITE_URL ? trim(process.env.NEXT_PUBLIC_SITE_URL) : "";

/** Lien vers une page de l'application : absolu (app.…) quand le domaine est configuré, relatif sinon. Évite de passer par www. */
export const appHref = (path: string) => `${APP_ORIGIN}${path}`;
/** Lien vers une page de la vitrine (docs…), pour les liens écrits depuis l'application. */
export const siteHref = (path: string) => `${SITE_ORIGIN}${path}`;

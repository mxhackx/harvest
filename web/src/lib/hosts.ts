/**
 * Trois domaines pour un même site Next.js : la vitrine (hivation.tech), l'application (app.…) et la documentation (docs.…).
 * Tous pointent vers le même déploiement ; le proxy renvoie chaque page vers son domaine.
 * Sans NEXT_PUBLIC_APP_URL ni NEXT_PUBLIC_DOCS_URL (développement, tests, prévisualisations), tout reste sur un seul domaine.
 */

/** Pages qui vivent sur le domaine de l'application. */
const APP_PREFIXES = ["/dashboard", "/login", "/invitation", "/forgot-password", "/reset-password", "/onboarding"];
/** La documentation : sur son propre domaine s'il est configuré, sinon sur celui de la vitrine. */
const DOCS_PREFIX = "/docs";
/** Le CMS : une application à part, sur son domaine s'il est configuré. */
const CMS_PREFIX = "/cms";

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

const trim = (url: string) => url.replace(/\/$/, "");

/**
 * Adresse vers laquelle renvoyer la requête, ou null si la page est déjà sur le bon domaine.
 * `host` est l'en-tête Host de la requête ; les autres domaines (localhost, prévisualisation Vercel) ne sont jamais redirigés.
 */
export function hostRedirect(host: string, pathname: string, search: string, siteUrl: string, appUrl: string | undefined, docsUrl?: string, cmsUrl?: string): string | null {
  const site = trim(siteUrl);
  const siteHost = new URL(site).host;
  // un domaine identique à la vitrine ne compte pas : il provoquerait une boucle
  const other = (url: string | undefined) => (url && new URL(url).host !== siteHost ? { origin: trim(url), host: new URL(url).host } : null);
  const app = other(appUrl);
  const docs = other(docsUrl);
  const cms = other(cmsUrl);
  if (!app && !docs && !cms) return null;
  const isCms = under(pathname, CMS_PREFIX);
  const isDocs = under(pathname, DOCS_PREFIX);
  const isApp = APP_PREFIXES.some((p) => under(pathname, p));
  const docsHome = docs?.origin ?? site;

  if (cms) {
    if (host === cms.host) {
      if (pathname === "/") return `${cms.origin}${CMS_PREFIX}${search}`;
      if (isCms) return null;
      return `${isDocs ? docsHome : isApp && app ? app.origin : site}${pathname}${search}`;
    }
    if (isCms && (host === siteHost || host === app?.host || host === docs?.host)) return `${cms.origin}${pathname}${search}`;
  }

  if (docs && host === docs.host) {
    if (pathname === "/") return `${docs.origin}${DOCS_PREFIX}${search}`;
    if (isDocs) return null;
    return `${isApp && app ? app.origin : site}${pathname}${search}`;
  }
  if (app && host === app.host) {
    if (pathname === "/") return `${app.origin}/dashboard${search}`;
    if (isDocs) return `${docsHome}${pathname}${search}`;
    return null;
  }
  if (host === siteHost) {
    if (isDocs && docs) return `${docs.origin}${pathname}${search}`;
    if (isApp && app) return `${app.origin}${pathname}${search}`;
  }
  return null;
}

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ? trim(process.env.NEXT_PUBLIC_APP_URL) : "";
const CMS_ORIGIN = process.env.NEXT_PUBLIC_CMS_URL ? trim(process.env.NEXT_PUBLIC_CMS_URL) : "";
const DOCS_ORIGIN = process.env.NEXT_PUBLIC_DOCS_URL ? trim(process.env.NEXT_PUBLIC_DOCS_URL) : "";
const SITE_ORIGIN = (APP_ORIGIN || DOCS_ORIGIN || CMS_ORIGIN) && process.env.NEXT_PUBLIC_SITE_URL ? trim(process.env.NEXT_PUBLIC_SITE_URL) : "";

/** Lien vers une page de l'application : absolu (app.…) quand le domaine est configuré, relatif sinon. Évite de passer par www. */
export const appHref = (path: string) => `${APP_ORIGIN}${path}`;
/** Lien vers une page de la vitrine, pour les liens écrits depuis l'application ou la documentation. */
export const siteHref = (path: string) => `${SITE_ORIGIN}${path}`;
/** Lien vers la documentation : son domaine, sinon la vitrine. */
export const docsHref = (path: string) => `${DOCS_ORIGIN || SITE_ORIGIN}${path}`;
/** Adresse publique d'une page de documentation (lien canonique, sitemap). */
export const docsUrl = (path: string, siteUrl: string) => `${DOCS_ORIGIN || siteUrl}${path}`;
/** Lien vers le CMS : son domaine, sinon le même site. */
export const cmsHref = (path: string) => `${CMS_ORIGIN}${path}`;

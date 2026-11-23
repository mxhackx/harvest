import { z } from "zod";

/** Hôtes acceptés : on n'affiche jamais un lien vers un domaine inattendu comme s'il venait de Facebook ou de Google. */
const FACEBOOK_HOST = /^(www\.|m\.|web\.|mbasic\.)?(facebook\.com|fb\.com|fb\.me)$/i;
export const GOOGLE_MAPS_HOST = /^((www|maps|consent)\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$|^(maps\.app\.)?goo\.gl$/i;

function toHttpUrl(raw: string): URL | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    // http(s) uniquement : javascript:, data:, etc. sont refusés
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

export function normalizeWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  const u = toHttpUrl(v);
  return u && u.hostname.includes(".") ? u.href : null;
}

/** Accepte un lien Facebook ou un identifiant (`@pharmacie.etoile`). */
export function normalizeFacebook(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  if (!/[/]|facebook|fb\.(com|me)/i.test(v)) {
    const handle = v.replace(/^@/, "");
    return /^[A-Za-z0-9._-]{1,80}$/.test(handle) ? `https://www.facebook.com/${handle}` : null;
  }
  const u = toHttpUrl(v);
  return u && FACEBOOK_HOST.test(u.hostname) ? u.href : null;
}

export function normalizeGoogleMapsUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  const u = toHttpUrl(v);
  if (!u || !GOOGLE_MAPS_HOST.test(u.hostname)) return null;
  // google.com/… hors cartes (recherche, compte…) : on ne garde que les liens de cartes
  const isMaps = /goo\.gl$/i.test(u.hostname) || u.hostname.startsWith("maps.") || u.pathname.startsWith("/maps");
  return isMaps ? u.href : null;
}

/** Numéro WhatsApp : chiffres avec « + » initial facultatif, 6 à 15 chiffres (E.164). */
export function normalizePhone(raw: string): string | null {
  let v = raw.trim().replace(/[\s().-]/g, "");
  if (!v) return "";
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  return /^\+?\d{6,15}$/.test(v) ? v : null;
}

const field = (max: number, normalize: (v: string) => string | null, message: string) =>
  z
    .string()
    .max(max)
    .transform((v, ctx) => {
      const out = normalize(v);
      if (out === null) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return out;
    });

export const whatsappField = field(40, normalizePhone, "numéro WhatsApp invalide (6 à 15 chiffres)");
export const facebookField = field(300, normalizeFacebook, "lien ou identifiant Facebook invalide");
export const websiteField = field(300, normalizeWebsite, "adresse de site web invalide");
export const googleMapsField = field(500, normalizeGoogleMapsUrl, "lien Google Maps invalide");

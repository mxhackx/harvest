import "dotenv/config";
import { BRAND_NAME } from "./brand.js";

const list = (v: string | undefined, fallback: string[]) =>
  v ? v.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean) : fallback;

const appUrls = list(process.env.APP_URLS, ["http://localhost:3000"]);

/**
 * Chemin du cookie d'état OAuth : il doit couvrir les routes /auth/… telles que le NAVIGATEUR les voit. Si l'API est
 * exposée sous un préfixe (https://site.example/api), le cookie doit l'être aussi, sinon il n'est jamais renvoyé.
 */
export const oauthCookiePath = (apiUrl: string) => `${new URL(apiUrl).pathname.replace(/\/$/, "")}/auth`;

export const config = {
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  /** Origines autorisées (CORS) ; la première sert de redirection par défaut. */
  appUrls,
  // Render fournit RENDER_EXTERNAL_URL ; derrière un proxy (site et API sous le même domaine) on fixe API_URL à la main.
  apiUrl: (process.env.API_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, ""),
  databaseUrl: process.env.DATABASE_URL!,
  /**
   * Géocodage des adresses (Nominatim par défaut). Désactivable : GEOCODING=off.
   * Les adresses saisies sont alors envoyées à ce service tiers.
   */
  geocodingEnabled: (process.env.GEOCODING ?? "on") !== "off" && process.env.NODE_ENV !== "test",
  geocoderUrl: (process.env.GEOCODER_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, ""),
  oauthCookiePath: "/auth",
  /** Appels de localisation par minute et par IP (ils déclenchent des requêtes sortantes). */
  locateRateLimit: process.env.NODE_ENV === "test" ? 10_000 : 30,
  /** Tentatives par minute et par IP sur les routes d'auth (large en test). */
  authRateLimit: process.env.NODE_ENV === "test" ? 10_000 : 10,
  /**
   * E-mails via Resend. Sans RESEND_API_KEY, rien n'est envoyé (l'application reste utilisable : les liens
   * s'affichent à l'écran). Tant qu'aucun domaine n'est vérifié chez Resend, l'expéditeur par défaut ne peut écrire
   * qu'à l'adresse du compte Resend : définir MAIL_FROM, ex. « Hivation <noreply@hivation.tech> ».
   */
  /**
   * Service d'itinéraires routiers (OSRM). Par défaut le serveur de démonstration public, à usage léger : pour un vrai
   * déploiement, hébergez le vôtre. « off » (ou NODE_ENV=test) coupe tout appel : les itinéraires sont alors estimés.
   * Les coordonnées des prospects d'une tournée sont envoyées à ce service.
   */
  routingUrl: process.env.NODE_ENV === "test" || process.env.ROUTING_URL === "off" ? "" : (process.env.ROUTING_URL ?? "https://router.project-osrm.org").replace(/\/$/, ""),
  /** Adresse qui reçoit les messages de la bulle de contact (ex. support@hivation.tech). Sans elle, les messages sont seulement gardés en base. */
  supportEmail: process.env.SUPPORT_EMAIL ?? "",
  mail: {
    apiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.MAIL_FROM ?? `${BRAND_NAME} <onboarding@resend.dev>`,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  },
};
config.oauthCookiePath = oauthCookiePath(config.apiUrl);

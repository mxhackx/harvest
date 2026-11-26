import type { NextConfig } from "next";
import { legacyRedirects } from "./src/lib/legacy-routes";
import { ROUTES } from "./src/lib/routes";

/**
 * Site et API sur deux domaines différents (Vercel + Render) : le cookie de session de l'API serait un cookie
 * « tiers », bloqué par Safari et Firefox. On fait donc relayer /api/* par le site : le navigateur ne parle qu'à
 * un seul domaine, et le cookie reste un cookie du site. Actif seulement si API_PROXY_TARGET est défini.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
if (apiProxyTarget && !/^https?:\/\//.test(apiProxyTarget)) {
  throw new Error("API_PROXY_TARGET doit commencer par http:// ou https://");
}

const nextConfig: NextConfig = {
  // Les tests de bout en bout compilent dans leur propre dossier pour ne pas gêner le serveur de dev.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return apiProxyTarget ? [{ source: "/api/:path*", destination: `${apiProxyTarget}/:path*` }] : [];
  },
  // Un module tapé seul dans la barre d'adresse mène à sa première page (temporaire : elle peut changer),
  // et les anciennes adresses françaises redirigent vers les actuelles (favoris, liens, e-mails déjà envoyés).
  async redirects() {
    return [
      { source: "/dashboard/crm", destination: ROUTES.leads, permanent: false },
      { source: "/dashboard/erp", destination: ROUTES.team, permanent: false },
      ...legacyRedirects(),
    ];
  },
  // le badge de développement recouvrirait la vignette de l'entreprise, en bas à gauche
  devIndicators: { position: "bottom-right" },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

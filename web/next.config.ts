import type { NextConfig } from "next";
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
  // Anciennes adresses : sans préfixe (avant /dashboard), puis sous /dashboard sans /crm. Favoris et liens déjà partagés.
  async redirects() {
    const crm = "leads|contacts|taches|modeles|pipeline|rapports";
    return [
      // Un module tapé seul dans la barre d'adresse mène à sa première page (temporaire : elle peut changer).
      { source: "/dashboard/crm", destination: ROUTES.leads, permanent: false },
      { source: "/dashboard/erp", destination: ROUTES.team, permanent: false },
      { source: `/:page(${crm})/:rest*`, destination: "/dashboard/crm/:page/:rest*", permanent: true },
      { source: `/dashboard/:page(${crm})/:rest*`, destination: "/dashboard/crm/:page/:rest*", permanent: true },
      { source: "/:page(equipe)/:rest*", destination: "/dashboard/erp/:page/:rest*", permanent: true },
      { source: "/dashboard/:page(equipe)/:rest*", destination: "/dashboard/erp/:page/:rest*", permanent: true },
      { source: "/calendrier", destination: "/dashboard/calendrier", permanent: true },
    ];
  },
  /* config options here */
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

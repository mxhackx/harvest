import type { NextConfig } from "next";

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
  // Les anciennes adresses de l'espace connecté (avant /dashboard) redirigent vers les nouvelles : favoris et liens déjà partagés.
  async redirects() {
    const moved = ["calendrier", "contacts", "equipe", "leads", "modeles", "pipeline", "rapports", "taches"];
    return [
      ...moved.map((p) => ({ source: `/${p}`, destination: `/dashboard/${p}`, permanent: true })),
      { source: "/leads/:id", destination: "/dashboard/leads/:id", permanent: true },
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

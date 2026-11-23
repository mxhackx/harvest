import "dotenv/config";

const list = (v: string | undefined, fallback: string[]) =>
  v ? v.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean) : fallback;

const appUrls = list(process.env.APP_URLS, ["http://localhost:3000"]);

export const config = {
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  /** Origines autorisées (CORS) ; la première sert de redirection par défaut. */
  appUrls,
  apiUrl: (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, ""),
  databaseUrl: process.env.DATABASE_URL!,
  /** Tentatives par minute et par IP sur les routes d'auth (large en test). */
  authRateLimit: process.env.NODE_ENV === "test" ? 10_000 : 10,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  },
};

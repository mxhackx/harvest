import { defineConfig } from "@playwright/test";

// Permet à context.route() d'intercepter aussi les requêtes du service worker (test du mode hors-ligne).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

// Les tests tournent sur leurs propres ports et leur propre base : jamais sur le serveur de développement.
const API = "http://localhost:4100";
const WEB = "http://localhost:3100";
const DB = process.env.E2E_DATABASE_URL ?? "postgres://harvest:harvest@localhost:54329/harvest_test";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: WEB,
    locale: "fr-FR",
    timezoneId: "Africa/Porto-Novo",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: CHROME,
      // WebGL logiciel : la carte (MapLibre) doit s'afficher sans carte graphique.
      args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  webServer: [
    { command: "bash -c \"exec env PORT=3101 node ../registry/serve.mjs\"", url: "http://localhost:3101/r/registry.json", reuseExistingServer: !process.env.CI },
    {
      // NODE_ENV=test : limites de requêtes relevées, géocodage coupé (aucun appel à un service tiers).
      command: `bash -c "cd ../api && DATABASE_URL=${DB} npx drizzle-kit migrate && exec env NODE_ENV=test PORT=4100 API_URL=${API} APP_URLS=${WEB} DATABASE_URL=${DB} GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GITHUB_CLIENT_ID= GITHUB_CLIENT_SECRET= npx tsx src/server.ts"`,
      url: `${API}/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `bash -c "node scripts/copy-maplibre.mjs && exec env NEXT_PUBLIC_API_URL=${API} NEXT_PUBLIC_SITE_URL=${WEB} NEXT_PUBLIC_REGISTRY_URL=http://localhost:3101 NEXT_DIST_DIR=.next-e2e npx next dev -p 3100"`,
      url: `${WEB}/login`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

// MapLibre charge son worker à côté de son module, ce que Turbopack ne publie pas.
// On le sert donc depuis /public (voir setWorkerUrl dans lead-map.tsx).
import { cpSync, mkdirSync } from "node:fs";

const from = "node_modules/maplibre-gl/dist";
const to = "public/maplibre";
mkdirSync(to, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) cpSync(`${from}/${f}`, `${to}/${f}`);

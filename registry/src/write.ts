import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildRegistry } from "./build";

const out = path.resolve(__dirname, "../public");
mkdirSync(path.join(out, "r"), { recursive: true });
const files = buildRegistry();
// un composant retiré ne doit pas rester en ligne
for (const f of readdirSync(path.join(out, "r"))) if (!(`r/${f}` in files)) rmSync(path.join(out, "r", f));
for (const [name, content] of Object.entries(files)) writeFileSync(path.join(out, name), content);
console.log(`${Object.keys(files).length} fichiers écrits dans registry/public`);

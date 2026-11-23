// Lance ESLint sur les fichiers indexés, depuis web/ (là où se trouve sa configuration).
// lint-staged transmet des chemins absolus ; on les convertit en chemins relatifs à web/.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const files = process.argv.slice(2).map((f) => path.relative(web, path.resolve(f)));
if (files.length === 0) process.exit(0);

const run = spawnSync("npx", ["eslint", "--max-warnings=0", ...files], { cwd: web, stdio: "inherit" });
process.exit(run.status ?? 1);

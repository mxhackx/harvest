// Garde-fou avant commit : refuse d'enregistrer un secret ou un fichier d'environnement.
// Il vérifie (1) les noms de fichiers, (2) des formes connues de clés, (3) les VRAIES valeurs secrètes
// de vos fichiers .env locaux, qu'un copier-coller pourrait faire fuiter sous n'importe quelle forme.
// Contournement volontaire et exceptionnel : git commit --no-verify
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const git = (...args) => execFileSync("git", args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
const staged = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").toString("utf8").split("\0").filter(Boolean);
const problems = [];

// 1. fichiers qui ne doivent jamais être versionnés
const FORBIDDEN_PATH = [
  [/(^|\/)\.env(\..+)?$/, (f) => !/\.example$/.test(f), "fichier d'environnement"],
  [/~$/, () => true, "sauvegarde d'éditeur (peut contenir une copie d'un .env)"],
  [/(^|\/)(id_rsa|id_ed25519)(\.pub)?$|\.(pem|p12|pfx|key)$/, () => true, "clé privée ou certificat"],
  [/(^|\/)credentials\.json$|\.cookie$/, () => true, "identifiants ou cookie de session"],
];
for (const f of staged) for (const [re, applies, what] of FORBIDDEN_PATH) if (re.test(f) && applies(f)) problems.push(`${f} : ${what}`);

// 2. formes connues de secrets
const PATTERNS = [
  [/GOCSPX-[A-Za-z0-9_-]{20,}/, "secret client Google"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "jeton GitHub"],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}/, "jeton GitHub"],
  [/\bAKIA[0-9A-Z]{16}\b/, "clé d'accès AWS"],
  [/\bxox[baprs]-[A-Za-z0-9-]{20,}/, "jeton Slack"],
  [/\bsk-[A-Za-z0-9]{32,}/, "clé d'API"],
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/, "clé privée"],
  [/postgres(?:ql)?:\/\/[^:\s/@]+:(?![^@\s]*(?:\[|password|harvest|postgres|changeme|example|\*\*\*))[^@\s]{6,}@(?!localhost|127\.0\.0\.1)/i, "URL de base de données avec mot de passe"],
];

// 3. valeurs réelles lues dans vos fichiers .env locaux (jamais affichées)
function localSecrets() {
  const root = git("rev-parse", "--show-toplevel").toString().trim();
  const files = [];
  const walk = (dir, depth) => {
    if (depth > 2) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name.startsWith(".next")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (/^\.env(\..+)?~?$/.test(e.name) && !/\.example$/.test(e.name)) files.push(full);
    }
  };
  walk(root, 0);
  const values = new Set();
  for (const f of files) {
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL)[A-Z0-9_]*)\s*=\s*(.+?)\s*$/.exec(line);
      const v = m?.[2].replace(/^["']|["']$/g, "");
      if (v && v.length >= 12 && !/localhost|127\.0\.0\.1|\[[A-Z_]+\]|\*\*\*/.test(v)) values.add(v);
    }
  }
  return [...values];
}
const secrets = localSecrets();

const isBinary = (buf) => buf.subarray(0, 8000).includes(0);
for (const f of staged) {
  if (/(^|\/)scripts\/check-secrets\.mjs$/.test(f)) continue; // ses propres motifs
  let buf;
  try {
    buf = git("show", `:${f}`);
  } catch {
    continue;
  }
  if (isBinary(buf)) continue;
  const text = buf.toString("utf8");
  for (const [re, what] of PATTERNS) if (re.test(text)) problems.push(`${f} : contient ce qui ressemble à un(e) ${what}`);
  if (secrets.some((s) => text.includes(s))) problems.push(`${f} : contient une valeur copiée depuis un de vos fichiers .env`);
}

if (problems.length) {
  console.error("\n✖ Commit bloqué : secret possible dans les fichiers indexés.\n");
  for (const p of [...new Set(problems)]) console.error(`  - ${p}`);
  console.error("\nRetirez-le de l'index (git restore --staged <fichier>) et gardez-le dans un .env ignoré par git.");
  console.error("Si c'est un faux positif : git commit --no-verify\n");
  process.exit(1);
}

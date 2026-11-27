/**
 * Transforme un site en projet Next.js complet : pages (front), route d'API (back), schéma Drizzle (base).
 * Tout texte saisi est écrit entre accolades avec JSON.stringify : il reste une donnée, jamais du code.
 */
import { walk, type Node, type Site, type Page, slug } from "./model";
import { cssText, rootVariables, safeHref, styleOf, FONTS } from "./style";

const str = (v: string) => `{${JSON.stringify(v)}}`;
const cls = (n: Node) => `n-${n.id.replace(/[^a-z0-9]/gi, "")}`;
const IMAGE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/;

function imageFile(n: Node): { path: string; bytes: Uint8Array } | null {
  const m = IMAGE.exec(n.src ?? "");
  if (!m) return null;
  return { path: `images/${cls(n)}.${m[1] === "jpeg" ? "jpg" : m[1]}`, bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) };
}

function jsx(n: Node, indent: string): string {
  if (n.hidden) return "";
  const c = `className="${cls(n)}"`;
  if (n.type === "text") {
    const tag = n.textStyle === "h1" ? "h1" : n.textStyle === "h2" ? "h2" : "p";
    return `${indent}<${tag} ${c}>${str(n.text ?? "")}</${tag}>\n`;
  }
  if (n.type === "button") return `${indent}<a ${c} href=${str(safeHref(n.href))}>${str(n.text ?? "")}</a>\n`;
  if (n.type === "image") {
    const file = imageFile(n);
    return file ? `${indent}<img ${c} src="/${file.path}" alt=${str(n.alt ?? "")} />\n` : "";
  }
  if (n.type === "form") return `${indent}<ContactForm className="${cls(n)}" button=${str(n.text || "Envoyer")} />\n`;
  const children = (n.children ?? []).map((x) => jsx(x, `${indent}  `)).join("");
  return children ? `${indent}<div ${c}>\n${children}${indent}</div>\n` : `${indent}<div ${c} />\n`;
}

function pageFile(page: Page): string {
  const forms = walk(page.root).some((n) => n.type === "form" && !n.hidden);
  const up = page.path ? "../../" : "../";
  return `${forms ? `import { ContactForm } from "${up}components/contact-form";\n\n` : ""}export const metadata = { title: ${JSON.stringify(page.name)} };

export default function Page() {
  return (
    <main>
${jsx(page.root, "      ")}    </main>
  );
}
`;
}

function css(site: Site): string {
  const nodes = site.pages.flatMap((p) => walk(p.root));
  const mobile: string[] = [];
  const rules = nodes.map((n) => {
    const wide = styleOf(n, site, false);
    const narrow = styleOf(n, site, true);
    const diff = Object.fromEntries(Object.entries(narrow).filter(([k, v]) => wide[k] !== v));
    if (Object.keys(diff).length) mobile.push(`.${cls(n)} {\n${cssText(diff)}\n}`);
    return Object.keys(wide).length ? `.${cls(n)} {\n${cssText(wide)}\n}` : "";
  });
  return `:root {
${cssText(rootVariables(site))}
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--fond); color: var(--texte); font-family: ${FONTS.sans}; }
main { min-height: 100dvh; }
input, textarea, button { font: inherit; padding: 12px 14px; border-radius: 10px; border: 1px solid currentColor; background: transparent; color: inherit; }
button { background: var(--accent); color: var(--fond); border-color: var(--accent); cursor: pointer; font-weight: 600; }

${rules.filter(Boolean).join("\n")}

@media (max-width: 640px) {
${mobile.join("\n")}
}
`;
}

const CONTACT_FORM = `"use client";

import { useState, type FormEvent } from "react";

export function ContactForm({ className, button }: { className: string; button: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }
  if (state === "sent") return <p className={className}>Merci, votre message est bien reçu.</p>;
  return (
    <form className={className} onSubmit={send}>
      <input name="name" placeholder="Votre nom" aria-label="Votre nom" required maxLength={100} />
      <input name="contact" placeholder="Téléphone ou e-mail" aria-label="Téléphone ou e-mail" required maxLength={150} />
      <textarea name="message" placeholder="Votre message" aria-label="Votre message" required rows={4} maxLength={2000} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
      <button type="submit" disabled={state === "sending"}>{button}</button>
      {state === "error" && <p role="alert">Le message n'a pas pu partir.</p>}
    </form>
  );
}
`;

const ROUTE = `import { z } from "zod";
import { db } from "../../../db";
import { messages } from "../../../db/schema";

const body = z.object({
  name: z.string().trim().min(1).max(100),
  contact: z.string().trim().min(3).max(150),
  message: z.string().trim().min(1).max(2000),
  website: z.string().max(0).optional(), // champ piège contre les robots
});

export async function POST(request: Request) {
  // seule une page de ce site peut écrire ici
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const { name, contact, message } = parsed.data;
  await db().insert(messages).values({ name, contact, message });
  return Response.json({ ok: true }, { status: 201 });
}
`;

export function exportProject(site: Site): Record<string, string | Uint8Array> {
  const name = slug(site.name) || "site";
  const files: Record<string, string | Uint8Array> = {
    "package.json": `${JSON.stringify({
      name,
      private: true,
      scripts: { dev: "next dev", build: "next build", start: "next start", "db:push": "drizzle-kit push" },
      dependencies: { next: "16.4.6", react: "19.3.0", "react-dom": "19.3.0", "drizzle-orm": "^0.45.4", postgres: "^4.1.1", zod: "^4.6.7" },
      devDependencies: { typescript: "^5", "@types/node": "^20", "@types/react": "^19", "@types/react-dom": "^19", "drizzle-kit": "^0.31.11" },
    }, null, 2)}\n`,
    "tsconfig.json": `${JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["dom", "dom.iterable", "es2022"], module: "esnext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true, isolatedModules: true, incremental: true, plugins: [{ name: "next" }] }, include: ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] }, null, 2)}\n`,
    ".gitignore": "node_modules\n.next\n.env*\n!.env.example\n",
    ".env.example": "DATABASE_URL=postgres://utilisateur:example-password@hote:5432/base\n",
    "drizzle.config.ts": `import { defineConfig } from "drizzle-kit";\n\nexport default defineConfig({ schema: "./db/schema.ts", dialect: "postgresql", dbCredentials: { url: process.env.DATABASE_URL! } });\n`,
    "db/schema.ts": `import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";\n\nexport const messages = pgTable("messages", {\n  id: serial("id").primaryKey(),\n  name: text("name").notNull(),\n  contact: text("contact").notNull(),\n  message: text("message").notNull(),\n  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),\n}).enableRLS();\n`,
    "db/index.ts": `import { drizzle } from "drizzle-orm/postgres-js";\nimport postgres from "postgres";\n\nlet instance: ReturnType<typeof drizzle> | null = null;\n\n/** Connexion ouverte à la première requête : la compilation n'a pas besoin de la base. */\nexport function db() {\n  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");\n  return (instance ??= drizzle(postgres(process.env.DATABASE_URL, { prepare: false })));\n}\n`,
    "app/api/contact/route.ts": ROUTE,
    "components/contact-form.tsx": CONTACT_FORM,
    "app/layout.tsx": `import "./globals.css";\nimport type { ReactNode } from "react";\n\nexport const metadata = { title: ${JSON.stringify(site.name)} };\n\nexport default function Layout({ children }: { children: ReactNode }) {\n  return (\n    <html lang="fr">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
    "app/globals.css": css(site),
    "README.md": `# ${name}\n\nProjet généré par le CMS Hivation.\n\n\`\`\`bash\nnpm install\ncp .env.example .env.local   # puis renseigner DATABASE_URL\nexport $(cat .env.local) && npm run db:push\nnpm run dev\n\`\`\`\n\n- Pages : \`app/\` · style : \`app/globals.css\`\n- API du formulaire : \`app/api/contact/route.ts\` · base : \`db/schema.ts\`\n- À ajouter avant la mise en ligne : une limite de débit sur l'API, les mentions légales.\n`,
  };
  for (const p of site.pages) {
    const path = slug(p.path);
    files[path ? `app/${path}/page.tsx` : "app/page.tsx"] = pageFile({ ...p, path });
    for (const n of walk(p.root)) {
      const image = n.type === "image" ? imageFile(n) : null;
      if (image) files[`public/${image.path}`] = image.bytes;
    }
  }
  return files;
}

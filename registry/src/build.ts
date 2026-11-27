/** Produit les fichiers statiques du registre : le catalogue JSON, un fichier par composant et la page « marketplace ». */
import { newSite, type Node } from "../../web/src/lib/cms/model";
import { parseNode } from "../../web/src/lib/cms/library";
import { cssText, rootVariables, styleOf } from "../../web/src/lib/cms/style";
import { COMPONENTS } from "./components";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// les aperçus utilisent le thème « Clair » du CMS
const site = newSite("Aperçu", "boutique");
const css: string[] = [`.preview {\n${cssText(rootVariables(site))}\n  background: var(--fond);\n  color: var(--texte);\n}`];

/** Même fonction de style que le canevas du CMS : l'aperçu est ce qui sera posé dans le site. */
function html(n: Node, id: { n: number }, component: string): string {
  const cls = `c-${component}-${id.n++}`;
  const style = styleOf(n, site, false);
  if (Object.keys(style).length) css.push(`.${cls} {\n${cssText(style)}\n}`);
  if (n.type === "image") return `<span class="${cls} ph">Photo</span>`;
  if (n.type === "text") return `<p class="${cls}">${esc(n.text ?? "")}</p>`;
  if (n.type === "button") return `<span class="${cls}">${esc(n.text ?? "")}</span>`;
  return `<div class="${cls}">${(n.children ?? []).map((c) => html(c, id, component)).join("")}</div>`;
}

export function buildRegistry(): Record<string, string> {
  css.length = 1;
  const items = COMPONENTS.map((c) => ({ ...c, license: "Hivation", author: "Hivation" }));
  const files: Record<string, string> = {
    "r/registry.json": `${JSON.stringify({ name: "hivation", homepage: "https://ui.hivation.tech", items }, null, 1)}\n`,
  };
  for (const item of items) files[`r/${item.name}.json`] = `${JSON.stringify(item, null, 1)}\n`;

  const categories = [...new Set(items.map((i) => i.category))];
  const cards = items
    .map((item) => {
      const node = parseNode(item.node);
      if (!node) throw new Error(`composant invalide : ${item.name}`);
      return `<article data-category="${esc(item.category)}" data-search="${esc(`${item.title} ${item.description} ${item.category}`.toLowerCase())}">
<div class="preview" aria-hidden="true">${html(node, { n: 0 }, item.name)}</div>
<div class="body"><h2>${esc(item.title)}</h2><p class="meta">${esc(item.category)} · v${item.version}</p><p>${esc(item.description)}</p>
<div class="actions"><a class="primary" data-add="${item.name}" href="https://cms.hivation.tech/cms?add=${item.name}">Ajouter à Hivation</a><button type="button" data-copy="${item.name}">Copier le JSON</button></div></div></article>`;
    })
    .join("\n");

  files["index.html"] = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Composants Hivation</title>
<meta name="description" content="Les composants prêts à poser dans les sites créés avec Hivation.">
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="previews.css">
</head>
<body>
<header>
<h1>Composants Hivation</h1>
<p>${items.length} composants à poser dans vos sites, aux couleurs de chaque client.</p>
<input id="search" type="search" placeholder="Rechercher un composant" aria-label="Rechercher un composant">
<nav aria-label="Catégories"><button type="button" aria-pressed="true" data-filter="">Tout</button>${categories.map((c) => `<button type="button" aria-pressed="false" data-filter="${esc(c)}">${esc(c)}</button>`).join("")}</nav>
</header>
<main>
${cards}
</main>
<script src="app.js"></script>
</body>
</html>
`;
  files["previews.css"] = `${css.join("\n")}\n`;
  return files;
}

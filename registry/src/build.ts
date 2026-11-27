/** Produit les fichiers statiques du registre : le catalogue JSON, un fichier par composant et la page « marketplace ». */
import { newSite, type Node } from "../../web/src/lib/cms/model";
import { parseNode } from "../../web/src/lib/cms/library";
import { cssText, rootVariables, styleOf } from "../../web/src/lib/cms/style";
import { COMPONENTS } from "./components";
import { SHADCN } from "./shadcn";

const SHADCN_LICENSE = `Composants de la catégorie « shadcn/ui » : adaptés de shadcn/ui (https://ui.shadcn.com).

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;

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
  const items = [...SHADCN, ...COMPONENTS].map((c) => ({ ...c, license: c.origin ? "MIT" : "Hivation", author: c.origin ? `adapté de ${c.origin}` : "Hivation" }));
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
<div class="actions"><button type="button" data-copy="${item.name}">Copier le JSON</button></div></div></article>`;
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
<p class="intro">${items.length} blocs prêts pour les sites créés avec Hivation : en-têtes, menus, tarifs, galeries, cartes et boutons, pensés pour les commerces et lisibles sur téléphone. Dans le CMS, ouvrez un site puis « Composants » : le bloc est copié dans la page, prend les couleurs du site et reste entièrement modifiable.</p>
<input id="search" type="search" placeholder="Rechercher un composant" aria-label="Rechercher un composant">
<nav aria-label="Catégories"><button type="button" aria-pressed="true" data-filter="">Tout</button>${categories.map((c) => `<button type="button" aria-pressed="false" data-filter="${esc(c)}">${esc(c)}</button>`).join("")}</nav>
</header>
<main>
${cards}
</main>
<footer><a href="licenses.txt">Licences</a></footer>
<script src="app.js"></script>
</body>
</html>
`;
  // la licence MIT demande que sa mention accompagne ce qui en est repris
  files["licenses.txt"] = SHADCN_LICENSE;
  files["previews.css"] = `${css.join("\n")}\n`;
  return files;
}

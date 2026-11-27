/**
 * Modèle d'un site : des pages, chacune faite d'un arbre de cadres et d'éléments, des variables de couleur et des styles
 * de texte. Les composants (React Bits, Bento…) et l'IA produiront ce même objet.
 * Enregistré côté serveur (lib/cms/remote.ts), validé par api/src/cms/site-schema.ts.
 */
export type NodeType = "frame" | "text" | "button" | "image" | "form";
export type Font = "sans" | "serif" | "mono" | "rounded";
export type Props = {
  direction?: "column" | "row";
  /** une rangée s'empile sur mobile */
  stack?: boolean;
  columns?: number;
  gap?: number;
  paddingY?: number;
  paddingX?: number;
  align?: "flex-start" | "center" | "flex-end" | "stretch";
  justify?: "flex-start" | "center" | "flex-end" | "space-between";
  maxWidth?: number;
  height?: number;
  background?: string;
  color?: string;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
  shadow?: number;
  opacity?: number;
  font?: Font;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right";
  fit?: "cover" | "contain";
};
export type Node = { id: string; type: NodeType; name: string; hidden?: boolean; props: Props; text?: string; href?: string; src?: string; alt?: string; textStyle?: string; children?: Node[] };
export type Page = { id: string; name: string; path: string; root: Node };
export type Variable = { name: string; value: string };
export type TextStyle = { id: string; name: string; font: Font; fontSize: number; fontWeight: number; lineHeight: number };
export type Site = { id: string; name: string; variables: Variable[]; styles: TextStyle[]; pages: Page[]; updatedAt: string };

export const TYPE_LABEL: Record<NodeType, string> = { frame: "Cadre", text: "Texte", button: "Bouton", image: "Image", form: "Formulaire" };
export const newId = () => Math.random().toString(36).slice(2, 10);

type Extra = Partial<Omit<Node, "id" | "type" | "props">>;
const node = (type: NodeType, name: string, props: Props = {}, extra: Extra = {}): Node => ({ id: newId(), type, name, props, ...(type === "frame" ? { children: [] } : {}), ...extra });
const frame = (name: string, props: Props, children: Node[]) => node("frame", name, { direction: "column", gap: 12, ...props }, { children });
const title = (text: string, textStyle = "h2") => node("text", "Titre", {}, { text, textStyle });
const para = (text: string) => node("text", "Paragraphe", { opacity: 0.8 }, { text, textStyle: "body" });
const button = (text: string, href: string) => node("button", "Bouton", { background: "$accent", color: "$fond", radius: 12, paddingY: 12, paddingX: 22, fontWeight: 600 }, { text, href });
const section = (name: string, children: Node[], props: Props = {}) => frame(name, { paddingY: 56, paddingX: 24, gap: 16, ...props }, children);

export const ELEMENTS: Record<NodeType, () => Node> = {
  frame: () => frame("Cadre", { paddingY: 16, paddingX: 16 }, []),
  text: () => para("Votre texte"),
  button: () => button("En savoir plus", "#"),
  image: () => node("image", "Image", { height: 220, radius: 12, fit: "cover" }, { src: "", alt: "" }),
  form: () => node("form", "Formulaire", { gap: 12 }, { text: "Envoyer" }),
};

const dish = (name: string, price: string) => frame(name, { direction: "row", justify: "space-between", paddingY: 8, borderColor: "$texte" }, [para(name), title(price, "label")]);

/** Blocs prêts à poser : de simples cadres déjà remplis, que l'on peut ensuite défaire élément par élément. */
export const SECTIONS: Record<string, { label: string; build: (siteName: string) => Node }> = {
  hero: { label: "En-tête", build: (n) => section("En-tête", [node("image", "Logo", { height: 72, maxWidth: 72, radius: 36, fit: "cover" }, { src: "", alt: "Logo" }), title(n, "h1"), para("Une phrase qui donne envie de venir."), button("Réserver", "#contact")], { align: "center", textAlign: "center" }) },
  menu: { label: "Menu / catalogue", build: () => section("Menu", [title("La carte"), dish("Poisson braisé", "6 000 F"), dish("Poulet bicyclette", "5 000 F")], { maxWidth: 720 }) },
  features: { label: "Cartes (bento)", build: () => section("Cartes", [title("Nos services"), frame("Grille", { columns: 3, gap: 16 }, ["Sur place", "À emporter", "Livraison"].map((t) => frame(t, { paddingY: 24, paddingX: 20, radius: 16, borderWidth: 1, borderColor: "$accent" }, [title(t, "label"), para("Décrivez ce service en une ligne.")])))]) },
  gallery: { label: "Galerie", build: () => section("Galerie", [title("Galerie"), frame("Photos", { columns: 3, gap: 8 }, [ELEMENTS.image(), ELEMENTS.image(), ELEMENTS.image()])]) },
  contact: { label: "Contact", build: () => section("Contact", [title("Nous écrire"), para("Cotonou, Bénin · Lundi à dimanche, 11 h – 23 h"), button("WhatsApp", "https://wa.me/"), ELEMENTS.form()], { maxWidth: 560 }) },
};

const page = (name: string, path: string, children: Node[]): Page => ({ id: newId(), name, path, root: frame("Page", { gap: 0 }, children) });

export const THEMES: Record<string, { label: string; accent: string; fond: string; texte: string; titles: Font }> = {
  nuit: { label: "Nuit", accent: "#e0a458", fond: "#16110d", texte: "#f6efe7", titles: "serif" },
  jardin: { label: "Jardin", accent: "#e8671c", fond: "#f4f1e8", texte: "#1f3b2a", titles: "serif" },
  clair: { label: "Clair", accent: "#0868c9", fond: "#ffffff", texte: "#14222e", titles: "sans" },
};
export const themeVariables = (id: string): Variable[] => (["accent", "fond", "texte"] as const).map((name) => ({ name, value: THEMES[id][name] }));

export const TEMPLATES: Record<string, { label: string; theme: string; sections: string[]; pages?: { name: string; path: string; sections: string[] }[] }> = {
  restaurant: { label: "Restaurant et bar", theme: "nuit", sections: ["hero", "menu", "gallery", "contact"], pages: [{ name: "La carte", path: "carte", sections: ["menu"] }] },
  boutique: { label: "Boutique", theme: "clair", sections: ["hero", "features", "gallery", "contact"] },
  vitrine: { label: "Page simple", theme: "jardin", sections: ["hero", "contact"] },
};

export function newSite(name: string, template = "restaurant"): Site {
  const t = TEMPLATES[template];
  const build = (ids: string[]) => ids.map((s) => SECTIONS[s].build(name));
  const titles = THEMES[t.theme].titles;
  return {
    id: newId(),
    name,
    variables: themeVariables(t.theme),
    styles: [
      { id: "h1", name: "Grand titre", font: titles, fontSize: 48, fontWeight: 700, lineHeight: 1.1 },
      { id: "h2", name: "Titre", font: titles, fontSize: 30, fontWeight: 700, lineHeight: 1.2 },
      { id: "label", name: "Intertitre", font: "sans", fontSize: 17, fontWeight: 600, lineHeight: 1.4 },
      { id: "body", name: "Texte", font: "sans", fontSize: 16, fontWeight: 400, lineHeight: 1.6 },
    ],
    pages: [page("Accueil", "", build(t.sections)), ...(t.pages ?? []).map((p) => page(p.name, p.path, build(p.sections)))],
    updatedAt: new Date().toISOString(),
  };
}

export const slug = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function addPage(site: Site, name: string): Site {
  const base = slug(name) || "page";
  let path = base;
  // « api » est réservé au code serveur du projet exporté
  for (let i = 2; path === "api" || site.pages.some((p) => p.path === path); i++) path = `${base}-${i}`;
  return { ...site, pages: [...site.pages, page(name, path, [])] };
}

// ---------- Arbre ----------
export function find(root: Node, id: string): Node | null {
  if (root.id === id) return root;
  for (const c of root.children ?? []) {
    const hit = find(c, id);
    if (hit) return hit;
  }
  return null;
}
export const walk = (root: Node): Node[] => [root, ...(root.children ?? []).flatMap(walk)];
const mapTree = (root: Node, fn: (children: Node[]) => Node[]): Node => (root.children ? { ...root, children: fn(root.children).map((c) => mapTree(c, fn)) } : root);

export const update = (root: Node, id: string, patch: Partial<Node>): Node => (root.id === id ? { ...root, ...patch } : root.children ? { ...root, children: root.children.map((c) => update(c, id, patch)) } : root);
export const remove = (root: Node, id: string): Node => mapTree(root, (cs) => cs.filter((c) => c.id !== id));
export const move = (root: Node, id: string, delta: -1 | 1): Node =>
  mapTree(root, (cs) => {
    const i = cs.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= cs.length) return cs;
    const next = [...cs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
/** Dans le cadre sélectionné, sinon juste après l'élément sélectionné, sinon au bout de la page. */
export function insert(root: Node, selected: string | null, added: Node): Node {
  const target = selected ? find(root, selected) : null;
  if (!target || target.type === "frame") {
    const into = target?.id ?? root.id;
    return update(root, into, { children: [...(find(root, into)!.children ?? []), added] });
  }
  return mapTree(root, (cs) => {
    const i = cs.findIndex((c) => c.id === target.id);
    return i < 0 ? cs : [...cs.slice(0, i + 1), added, ...cs.slice(i + 1)];
  });
}
export const clone = (n: Node): Node => ({ ...structuredClone(n), id: newId(), ...(n.children ? { children: n.children.map(clone) } : {}) });
export function duplicate(root: Node, id: string): Node {
  const source = find(root, id);
  if (!source || source === root) return root;
  return mapTree(root, (cs) => {
    const i = cs.findIndex((c) => c.id === id);
    return i < 0 ? cs : [...cs.slice(0, i + 1), clone(source), ...cs.slice(i + 1)];
  });
}

// ---------- Contrôles de publication (cahier des charges §11.3) ----------
export type Check = { code: string; ok: boolean; text: string; pageId?: string; nodeId?: string };
const PLACEHOLDER = /lorem ipsum|titre ici|votre texte|une phrase qui donne envie|décrivez ce service|\bundefined\b|\bnull\b/i;
export const emptyLink = (href = "") => ["", "#", "https://wa.me/", "tel:", "mailto:"].includes(href.trim());

export function checkSite(site: Site): Check[] {
  const all = site.pages.flatMap((p) => walk(p.root).filter((n) => !n.hidden).map((n) => ({ n, pageId: p.id })));
  const result = (code: string, text: string, bad?: { n: Node; pageId: string }, ok = !bad): Check => ({ code, text, ok, pageId: bad?.pageId, nodeId: bad?.n.id });
  const logo = all.find((x) => x.n.type === "image" && x.n.name === "Logo");
  return [
    result("C04", "Logo présent", logo, !!logo?.n.src),
    result("C06", "Aucun texte de remplacement", all.find((x) => PLACEHOLDER.test(x.n.text ?? ""))),
    result("C07", "Aucun lien vide", all.find((x) => x.n.type === "button" && emptyLink(x.n.href))),
    result("C11", "Texte alternatif sur chaque image", all.find((x) => x.n.type === "image" && !!x.n.src && !x.n.alt?.trim())),
  ];
}

/** Réduit une photo avant de l'enregistrer avec le site. */
export async function resizeImage(file: File, max = 900): Promise<string> {
  const image = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * k);
  canvas.height = Math.round(image.height * k);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/webp", 0.8);
}

/** Glisser-déposer : placer `added` avant, après ou dans `targetId`. */
export function place(root: Node, targetId: string, where: "before" | "after" | "inside", added: Node): Node {
  const target = find(root, targetId);
  if (!target) return root;
  if (target === root || (where === "inside" && target.type === "frame")) return update(root, target.id, { children: [...(target.children ?? []), added] });
  return mapTree(root, (cs) => {
    const i = cs.findIndex((c) => c.id === targetId);
    if (i < 0) return cs;
    const at = where === "before" ? i : i + 1;
    return [...cs.slice(0, at), added, ...cs.slice(at)];
  });
}
/** Déplace un élément existant ; refuse de le mettre dans lui-même ou dans l'un de ses enfants. */
export function drop(root: Node, dragId: string, targetId: string, where: "before" | "after" | "inside"): Node {
  const dragged = find(root, dragId);
  if (!dragged || dragged === root || find(dragged, targetId)) return root;
  return place(remove(root, dragId), targetId, where, dragged);
}

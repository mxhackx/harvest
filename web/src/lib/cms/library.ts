/**
 * Composants venus du registre (registry/). Ce sont des DONNÉES : un arbre de nœuds, jamais du code.
 * Tout ce qui arrive est revérifié ici avant d'entrer dans un site.
 */
import { newId, type Node, type NodeType, type Props } from "./model";
import { cssColor, safeHref } from "./style";

export type Component = { name: string; title: string; category: string; description: string; version: number; license: string; author: string; atom: string; node: unknown };

export const REGISTRY_URL = (process.env.NEXT_PUBLIC_REGISTRY_URL ?? (process.env.NODE_ENV === "production" ? "https://ui.hivation.tech" : "http://localhost:3001")).replace(/\/$/, "");

const MAX_NODES = 80;
const TYPES: NodeType[] = ["frame", "text", "button", "image", "form"];
const NUMBERS = ["columns", "gap", "paddingY", "paddingX", "maxWidth", "height", "radius", "borderWidth", "shadow", "opacity", "fontSize", "fontWeight", "lineHeight", "letterSpacing"] as const;
const CHOICES: Record<string, string[]> = {
  direction: ["column", "row"],
  align: ["flex-start", "center", "flex-end", "stretch"],
  justify: ["flex-start", "center", "flex-end", "space-between"],
  textAlign: ["left", "center", "right"],
  font: ["sans", "serif", "mono", "rounded"],
  fit: ["cover", "contain"],
};
const IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

function props(raw: unknown): Props {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of NUMBERS) if (typeof p[k] === "number" && Number.isFinite(p[k])) out[k] = p[k];
  for (const [k, list] of Object.entries(CHOICES)) if (list.includes(p[k] as string)) out[k] = p[k];
  for (const k of ["background", "color", "borderColor"]) if (cssColor(text(p[k], 40))) out[k] = p[k];
  if (typeof p.stack === "boolean") out.stack = p.stack;
  return out as Props;
}

/** Un arbre sûr avec de nouveaux identifiants, ou null si le composant est invalide ou trop gros. */
export function parseNode(raw: unknown): Node | null {
  let count = 0;
  const read = (value: unknown, depth: number): Node | null => {
    if (!value || typeof value !== "object" || depth > 8 || ++count > MAX_NODES) return null;
    const v = value as Record<string, unknown>;
    if (!TYPES.includes(v.type as NodeType)) return null;
    const type = v.type as NodeType;
    const node: Node = { id: newId(), type, name: text(v.name, 60) || "Composant", props: props(v.props) };
    if (v.text !== undefined) node.text = text(v.text, 2000);
    if (type === "button") node.href = safeHref(text(v.href, 500));
    if (type === "text" && typeof v.textStyle === "string" && ["h1", "h2", "label", "body"].includes(v.textStyle)) node.textStyle = v.textStyle;
    if (type === "image") {
      // jamais d'image distante : elle pisterait les visiteurs et pourrait changer après coup
      node.src = typeof v.src === "string" && IMAGE.test(v.src) ? v.src : "";
      node.alt = text(v.alt, 200) ?? "";
    }
    if (type === "frame") {
      const children = (Array.isArray(v.children) ? v.children : []).map((c) => read(c, depth + 1));
      if (children.some((c) => !c)) return null;
      node.children = children as Node[];
    }
    return node;
  };
  const root = read(raw, 0);
  return count > MAX_NODES ? null : root;
}

export function parseCatalog(raw: unknown): Component[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((i): i is Component => !!i && typeof i === "object" && /^[a-z0-9-]{1,60}$/.test((i as Component).name) && typeof (i as Component).title === "string" && !!parseNode((i as Component).node))
    .slice(0, 500);
}

export async function fetchCatalog(url = REGISTRY_URL): Promise<Component[]> {
  const res = await fetch(`${url}/r/registry.json`, { credentials: "omit" });
  if (!res.ok) throw new Error(`registre indisponible (${res.status})`);
  return parseCatalog(await res.json());
}

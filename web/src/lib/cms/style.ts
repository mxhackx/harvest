/**
 * La seule traduction « propriétés → CSS » : le canevas et le code exporté s'en servent tous les deux, ils ne peuvent donc
 * pas diverger. Toute valeur est filtrée ici (elle viendra aussi d'une IA).
 */
import type { Font, Node, Site } from "./model";

export const FONTS: Record<Font, string> = {
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, Menlo, Consolas, monospace",
  rounded: "ui-rounded, 'Nunito', 'Segoe UI', sans-serif",
};
export const FONT_LABEL: Record<Font, string> = { sans: "Sans", serif: "Serif", mono: "Mono", rounded: "Arrondie" };
const SHADOWS = ["none", "0 1px 4px rgba(0,0,0,0.12)", "0 8px 24px rgba(0,0,0,0.16)", "0 20px 50px rgba(0,0,0,0.24)"];

export const varName = (name: string) => name.toLowerCase().replace(/[^a-z0-9-]/g, "") || "v";
export const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
/** « $accent » renvoie à une variable ; sinon seule une couleur hexadécimale est admise. */
export const cssColor = (v?: string): string | undefined => (!v ? undefined : v.startsWith("$") ? `var(--${varName(v.slice(1))})` : isHex(v) ? v : undefined);
export const safeHref = (href = ""): string => (/^(https?:\/\/|tel:|mailto:|\/(?!\/)|#)/i.test(href.trim()) ? href.trim() : "#");

const px = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) ? `${Math.min(4000, Math.max(-100, n))}px` : undefined);
const oneOf = <T extends string>(v: T | undefined, list: readonly T[]) => (v && list.includes(v) ? v : undefined);
export type Css = Record<string, string | number>;

export function styleOf(n: Node, site: Site, mobile: boolean): Css {
  const p = n.props;
  const text = site.styles.find((s) => s.id === n.textStyle);
  const size = p.fontSize ?? text?.fontSize;
  const font = p.font ?? text?.font;
  const out: Record<string, string | number | undefined> = {
    background: cssColor(p.background),
    color: cssColor(p.color),
    borderRadius: px(p.radius),
    boxShadow: p.shadow ? SHADOWS[p.shadow] : undefined,
    opacity: typeof p.opacity === "number" && p.opacity < 1 ? Math.max(0, p.opacity) : undefined,
    border: p.borderWidth ? `${px(p.borderWidth)} solid ${cssColor(p.borderColor) ?? "currentColor"}` : undefined,
    padding: p.paddingY || p.paddingX ? `${px(p.paddingY ?? 0)} ${px(p.paddingX ?? 0)}` : undefined,
    fontFamily: font ? FONTS[font] : undefined,
    // les grands titres rétrécissent sur mobile
    fontSize: px(size && mobile && size > 28 ? Math.round(size * 0.72) : size),
    fontWeight: p.fontWeight ?? text?.fontWeight,
    lineHeight: p.lineHeight ?? text?.lineHeight,
    letterSpacing: px(p.letterSpacing),
    textAlign: oneOf(p.textAlign, ["left", "center", "right"]),
    height: px(p.height),
  };
  if (p.maxWidth) Object.assign(out, { maxWidth: px(p.maxWidth), width: "100%", marginLeft: "auto", marginRight: "auto" });
  if (n.type === "frame" || n.type === "form") {
    if (p.columns && p.columns > 1) Object.assign(out, { display: "grid", gridTemplateColumns: `repeat(${Math.min(6, mobile ? 1 : p.columns)}, minmax(0, 1fr))` });
    else Object.assign(out, { display: "flex", flexDirection: p.direction === "row" && !(mobile && p.stack) ? "row" : "column", justifyContent: oneOf(p.justify, ["flex-start", "center", "flex-end", "space-between"]) });
    Object.assign(out, { gap: px(p.gap), alignItems: oneOf(p.align, ["flex-start", "center", "flex-end", "stretch"]) });
  }
  if (n.type === "text") Object.assign(out, { margin: out.marginLeft ? undefined : "0", whiteSpace: "pre-wrap" });
  if (n.type === "button") Object.assign(out, { display: "inline-block", width: "fit-content", textDecoration: "none" });
  if (n.type === "image") Object.assign(out, { display: "block", width: "100%", objectFit: oneOf(p.fit, ["cover", "contain"]) ?? "cover" });
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Css;
}

export const rootVariables = (site: Site): Css => Object.fromEntries(site.variables.map((v) => [`--${varName(v.name)}`, isHex(v.value) ? v.value : "#000000"]));
export const cssText = (style: Css) => Object.entries(style).map(([k, v]) => `  ${k.startsWith("--") ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v};`).join("\n");

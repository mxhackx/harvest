"use client";

import { newId, resizeImage, themeVariables, THEMES, TYPE_LABEL, type Node, type Page, type Props, type Site, type TextStyle } from "@/lib/cms/model";
import { FONT_LABEL, isHex, varName } from "@/lib/cms/style";
import { PlusIcon, TrashIcon } from "../icons";

const group = "flex flex-col gap-2 border-b border-rule p-3";
const input = "h-8 w-full min-w-0 rounded-micro border border-border bg-field px-2 text-small";
const chip = (on: boolean) => `h-7 flex-1 rounded-micro border px-1 text-caption ${on ? "border-accent bg-accent-soft text-accent-press" : "border-border hover:bg-field"}`;
const small = "flex size-7 shrink-0 items-center justify-center rounded-micro text-muted hover:bg-field hover:text-fail";
const Title = ({ children }: { children: string }) => <p className="text-caption font-semibold uppercase text-muted">{children}</p>;
const options = (record: Record<string, string>) => Object.entries(record).map(([v, l]) => <option key={v} value={v}>{l}</option>);

function Num({ label, value, onChange, step = 1 }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; step?: number }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-caption text-muted">
      {label}
      <input type="number" step={step} value={value ?? ""} placeholder="auto" onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} className={`${input} font-mono text-ink`} />
    </label>
  );
}

function Text({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-caption text-muted">
      {label}
      {multiline ? <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${input} h-auto py-1 text-ink`} /> : <input value={value} onChange={(e) => onChange(e.target.value)} className={`${input} text-ink`} />}
    </label>
  );
}

function Segmented<T extends string | number>({ label, value, choices, onChange }: { label: string; value: T | undefined; choices: [T, string][]; onChange: (v: T | undefined) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <span className="text-caption text-muted">{label}</span>
      <span className="flex gap-1">
        {choices.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(value === v ? undefined : v)} className={chip(value === v)}>{l}</button>)}
      </span>
    </div>
  );
}

/** Couleur : une variable du site (recommandé) ou une valeur libre. */
function Color({ label, value, site, onChange }: { label: string; value: string | undefined; site: Site; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex items-center gap-2 text-caption text-muted">
      <span className="w-16 shrink-0">{label}</span>
      <select aria-label={`${label} : variable`} value={value?.startsWith("$") ? value : value ? "custom" : ""} onChange={(e) => onChange(e.target.value === "custom" ? "#000000" : e.target.value || undefined)} className={`${input} text-ink`}>
        <option value="">Aucune</option>
        {site.variables.map((v) => <option key={v.name} value={`$${v.name}`}>${v.name}</option>)}
        {value?.includes("/") && <option value={value}>{value.replace("/", " à ")} %</option>}
        <option value="custom">Libre…</option>
      </select>
      {value && !value.startsWith("$") && <input type="color" aria-label={`${label} : valeur`} value={isHex(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="size-8 shrink-0 rounded-micro border border-border" />}
    </div>
  );
}

/** Panneau « Design » : contenu et propriétés de l'élément sélectionné. */
export function NodeFields({ node: n, site, isRoot, onChange }: { node: Node; site: Site; isRoot: boolean; onChange: (patch: Partial<Node>) => void }) {
  const p = n.props;
  const set = (patch: Props) => onChange({ props: { ...p, ...patch } });
  const container = n.type === "frame" || n.type === "form";
  const texty = n.type === "text" || n.type === "button" || n.type === "frame";
  return (
    <>
      <div className={group}>
        <Title>{isRoot ? "Page" : TYPE_LABEL[n.type]}</Title>
        <Text label="Nom du calque" value={n.name} onChange={(name) => onChange({ name })} />
        {(n.type === "text" || n.type === "button" || n.type === "form") && <Text label={n.type === "text" ? "Texte" : "Libellé"} value={n.text ?? ""} multiline={n.type === "text"} onChange={(text) => onChange({ text })} />}
        {n.type === "button" && <Text label="Lien (https://, tel:, /page, #)" value={n.href ?? ""} onChange={(href) => onChange({ href })} />}
        {n.type === "image" && (
          <>
            <label className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-micro border border-frame text-small font-medium hover:bg-field focus-within:outline-2 focus-within:outline-accent">
              <PlusIcon size={13} /> {n.src ? "Changer l’image" : "Choisir une image"}
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Image" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; const src = f ? await resizeImage(f).catch(() => "") : ""; if (src) onChange({ src }); }} />
            </label>
            <Text label="Texte alternatif" value={n.alt ?? ""} onChange={(alt) => onChange({ alt })} />
            <Segmented label="Cadrage" value={p.fit} choices={[["cover", "Remplir"], ["contain", "Contenir"]]} onChange={(fit) => set({ fit })} />
          </>
        )}
      </div>
      {container && (
        <div className={group}>
          <Title>Disposition</Title>
          <Segmented label="Direction" value={p.direction ?? "column"} choices={[["column", "Colonne"], ["row", "Rangée"]]} onChange={(direction) => set({ direction })} />
          {p.direction === "row" && (
            <label className="flex items-center gap-2 text-small"><input type="checkbox" className="accent-accent" checked={!!p.stack} onChange={(e) => set({ stack: e.target.checked })} /> Empiler sur mobile</label>
          )}
          <div className="flex gap-2">
            <Num label="Colonnes (grille)" value={p.columns} onChange={(columns) => set({ columns })} />
            <Num label="Espacement" value={p.gap} onChange={(gap) => set({ gap })} />
          </div>
          <Segmented label="Alignement" value={p.align} choices={[["flex-start", "Début"], ["center", "Centre"], ["flex-end", "Fin"], ["stretch", "Étirer"]]} onChange={(align) => set({ align })} />
          <Segmented label="Répartition" value={p.justify} choices={[["flex-start", "Début"], ["center", "Centre"], ["flex-end", "Fin"], ["space-between", "Écartée"]]} onChange={(justify) => set({ justify })} />
        </div>
      )}
      <div className={group}>
        <Title>Taille et marges</Title>
        <div className="flex gap-2">
          <Num label="Marge haut/bas" value={p.paddingY} onChange={(paddingY) => set({ paddingY })} />
          <Num label="Marge côtés" value={p.paddingX} onChange={(paddingX) => set({ paddingX })} />
        </div>
        <div className="flex gap-2">
          <Num label="Largeur max" value={p.maxWidth} onChange={(maxWidth) => set({ maxWidth })} />
          <Num label="Hauteur" value={p.height} onChange={(height) => set({ height })} />
        </div>
      </div>
      {texty && (
        <div className={group}>
          <Title>Typographie</Title>
          {n.type === "text" && (
            <label className="flex flex-col gap-1 text-caption text-muted">
              Style de texte
              <select value={n.textStyle ?? ""} onChange={(e) => onChange({ textStyle: e.target.value || undefined })} className={`${input} text-ink`}>
                <option value="">Aucun</option>
                {site.styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-caption text-muted">
            Police
            <select value={p.font ?? ""} onChange={(e) => set({ font: (e.target.value || undefined) as Props["font"] })} className={`${input} text-ink`}><option value="">Héritée</option>{options(FONT_LABEL)}</select>
          </label>
          <div className="flex gap-2">
            <Num label="Taille" value={p.fontSize} onChange={(fontSize) => set({ fontSize })} />
            <Num label="Graisse" step={100} value={p.fontWeight} onChange={(fontWeight) => set({ fontWeight })} />
          </div>
          <div className="flex gap-2">
            <Num label="Interligne" step={0.1} value={p.lineHeight} onChange={(lineHeight) => set({ lineHeight })} />
            <Num label="Interlettrage" step={0.5} value={p.letterSpacing} onChange={(letterSpacing) => set({ letterSpacing })} />
          </div>
          <Segmented label="Alignement du texte" value={p.textAlign} choices={[["left", "Gauche"], ["center", "Centre"], ["right", "Droite"]]} onChange={(textAlign) => set({ textAlign })} />
        </div>
      )}
      <div className={group}>
        <Title>Apparence</Title>
        <Color label="Fond" site={site} value={p.background} onChange={(background) => set({ background })} />
        <Color label="Texte" site={site} value={p.color} onChange={(color) => set({ color })} />
        <Color label="Contour" site={site} value={p.borderColor} onChange={(borderColor) => set({ borderColor })} />
        <div className="flex gap-2">
          <Num label="Épaisseur" value={p.borderWidth} onChange={(borderWidth) => set({ borderWidth })} />
          <Num label="Arrondi" value={p.radius} onChange={(radius) => set({ radius })} />
          <Num label="Opacité" step={0.1} value={p.opacity} onChange={(opacity) => set({ opacity })} />
        </div>
        <Segmented label="Ombre" value={p.shadow} choices={[[1, "Fine"], [2, "Moyenne"], [3, "Forte"]]} onChange={(shadow) => set({ shadow })} />
      </div>
    </>
  );
}

export function PageFields({ page, onChange }: { page: Page; onChange: (patch: Partial<Page>) => void }) {
  return (
    <div className={group}>
      <Text label="Nom de la page" value={page.name} onChange={(name) => onChange({ name })} />
      <p className="font-mono text-caption text-muted">Adresse : /{page.path}</p>
    </div>
  );
}

/** Onglet « Styles » : variables de couleur et styles de texte, partagés par toutes les pages. */
export function StyleFields({ site, onChange }: { site: Site; onChange: (patch: Partial<Site>) => void }) {
  const setStyle = (id: string, patch: Partial<TextStyle>) => onChange({ styles: site.styles.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  return (
    <>
      <div className={group}>
        <Title>Thèmes</Title>
        <div className="flex gap-1">{Object.entries(THEMES).map(([id, t]) => <button key={id} type="button" className={chip(false)} onClick={() => onChange({ variables: [...themeVariables(id), ...site.variables.slice(3)] })}>{t.label}</button>)}</div>
      </div>
      <div className={group}>
        <Title>Variables</Title>
        {site.variables.map((v, i) => (
          <div key={v.name} className="flex items-center gap-2 text-small">
            <span className="min-w-0 flex-1 truncate font-mono">${v.name}</span>
            <input type="color" aria-label={`Variable ${v.name}`} value={isHex(v.value) ? v.value : "#000000"} onChange={(e) => onChange({ variables: site.variables.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} className="size-8 rounded-micro border border-border" />
            {i > 2 ? <button type="button" aria-label={`Supprimer la variable ${v.name}`} className={small} onClick={() => onChange({ variables: site.variables.filter((_, j) => j !== i) })}><TrashIcon size={13} /></button> : <span className="size-7" />}
          </div>
        ))}
        <button
          type="button"
          className="h-8 rounded-micro border border-frame text-small hover:bg-field"
          onClick={() => {
            const name = varName(window.prompt("Nom de la variable (ex. secondaire)") ?? "");
            if (name !== "v" && !site.variables.some((v) => v.name === name)) onChange({ variables: [...site.variables, { name, value: "#888888" }] });
          }}
        >
          Ajouter une variable
        </button>
      </div>
      <div className={group}>
        <Title>Styles de texte</Title>
        {site.styles.map((s) => (
          <fieldset key={s.id} className="flex flex-col gap-1 rounded-micro border border-border p-2">
            <input aria-label="Nom du style" value={s.name} onChange={(e) => setStyle(s.id, { name: e.target.value })} className={`${input} font-semibold`} />
            <select aria-label={`Police du style ${s.name}`} value={s.font} onChange={(e) => setStyle(s.id, { font: e.target.value as TextStyle["font"] })} className={input}>{options(FONT_LABEL)}</select>
            <div className="flex gap-2">
              <Num label="Taille" value={s.fontSize} onChange={(v) => setStyle(s.id, { fontSize: v ?? 16 })} />
              <Num label="Graisse" step={100} value={s.fontWeight} onChange={(v) => setStyle(s.id, { fontWeight: v ?? 400 })} />
              <Num label="Interligne" step={0.1} value={s.lineHeight} onChange={(v) => setStyle(s.id, { lineHeight: v ?? 1.5 })} />
            </div>
          </fieldset>
        ))}
        <button type="button" className="h-8 rounded-micro border border-frame text-small hover:bg-field" onClick={() => onChange({ styles: [...site.styles, { id: newId(), name: "Nouveau style", font: "sans", fontSize: 16, fontWeight: 400, lineHeight: 1.5 }] })}>Ajouter un style</button>
      </div>
    </>
  );
}

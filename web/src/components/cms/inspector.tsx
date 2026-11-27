"use client";

import { FONT_LABEL, PRESETS, resizeImage, type Block, type Font, type Photo, type Site, type SiteTheme } from "@/lib/cms/site";
import { PlusIcon, TrashIcon } from "../icons";
import { Field, Select, TextArea } from "../ui";

const section = "flex flex-col gap-3 border-b border-rule p-3";
const small = "flex size-7 items-center justify-center rounded-micro text-muted hover:bg-field hover:text-fail";

function ImageInput({ label, onPick }: { label: string; onPick: (src: string) => void }) {
  return (
    <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-control border border-frame text-small font-medium hover:bg-field focus-within:outline-2 focus-within:outline-accent">
      <PlusIcon size={14} /> {label}
      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={label} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(await resizeImage(f).catch(() => "")); }} />
    </label>
  );
}

/** Propriétés du bloc sélectionné. */
export function BlockFields({ block: b, onChange }: { block: Block; onChange: (patch: Partial<Block>) => void }) {
  const text = (key: "title" | "button" | "phone" | "address" | "hours", label: string) => <Field label={label} value={b[key]} onChange={(e) => onChange({ [key]: e.target.value })} />;
  const photo = (i: number, p: Partial<Photo>) => onChange({ photos: b.photos.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <>
      <div className={section}>
        {text("title", "Titre")}
        {(b.type === "hero" || b.type === "whatsapp") && <TextArea label={b.type === "hero" ? "Accroche" : "Message prérempli"} rows={3} value={b.text} onChange={(e) => onChange({ text: e.target.value })} />}
        {(b.type === "hero" || b.type === "whatsapp") && text("button", "Texte du bouton")}
        {(b.type === "contact" || b.type === "whatsapp") && text("phone", "Téléphone (+229…)")}
        {b.type === "contact" && <>{text("address", "Adresse")}{text("hours", "Horaires")}</>}
      </div>
      {b.type === "hero" && (
        <div className={section}>
          <ImageInput label={b.logo ? "Changer le logo" : "Ajouter le logo"} onPick={(logo) => onChange({ logo })} />
          <ImageInput label={b.image.src ? "Changer la photo" : "Ajouter une photo"} onPick={(src) => onChange({ image: { ...b.image, src } })} />
          {b.image.src && <Field label="Texte alternatif de la photo" value={b.image.alt} onChange={(e) => onChange({ image: { ...b.image, alt: e.target.value } })} />}
        </div>
      )}
      {b.type === "menu" && (
        <div className={section}>
          {b.items.map((it, i) => {
            const set = (p: Partial<typeof it>) => onChange({ items: b.items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <fieldset key={i} className="flex flex-col gap-2 rounded-control border border-border p-2">
                <div className="flex items-center justify-between">
                  <legend className="float-left text-small font-medium">Article {i + 1}</legend>
                  <button type="button" aria-label={`Supprimer l'article ${i + 1}`} className={small} onClick={() => onChange({ items: b.items.filter((_, j) => j !== i) })}><TrashIcon size={14} /></button>
                </div>
                <Field label="Nom" value={it.name} onChange={(e) => set({ name: e.target.value })} />
                <Field label="Description" value={it.description} onChange={(e) => set({ description: e.target.value })} />
                <Field label="Prix (FCFA)" inputMode="numeric" value={it.price} onChange={(e) => set({ price: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
              </fieldset>
            );
          })}
          <button type="button" className="h-9 rounded-control border border-frame text-small font-medium hover:bg-field" onClick={() => onChange({ items: [...b.items, { name: "Nouvel article", description: "", price: "0" }] })}>Ajouter un article</button>
        </div>
      )}
      {b.type === "gallery" && (
        <div className={section}>
          {b.photos.map((p, i) => (
            <div key={i} className="flex items-end gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" className="size-10 rounded-micro object-cover" />
              <Field label="Texte alternatif" value={p.alt} onChange={(e) => photo(i, { alt: e.target.value })} />
              <button type="button" aria-label={`Retirer la photo ${i + 1}`} className={small} onClick={() => onChange({ photos: b.photos.filter((_, j) => j !== i) })}><TrashIcon size={14} /></button>
            </div>
          ))}
          {b.photos.length < 8 && <ImageInput label="Ajouter une photo" onPick={(src) => src && onChange({ photos: [...b.photos, { src, alt: "" }] })} />}
        </div>
      )}
    </>
  );
}

/** Thème du site : préréglages, couleurs, police et arrondis. */
export function ThemeFields({ site, onChange }: { site: Site; onChange: (theme: SiteTheme) => void }) {
  const t = site.theme;
  const color = (key: "accent" | "background" | "ink", label: string) => (
    <label className="flex items-center justify-between gap-3 text-small font-medium">
      {label}
      <span className="flex items-center gap-2">
        <span className="font-mono text-caption uppercase text-muted">{t[key]}</span>
        <input type="color" value={t[key]} onChange={(e) => onChange({ ...t, [key]: e.target.value })} className="size-8 cursor-pointer rounded-micro border border-frame bg-card" />
      </span>
    </label>
  );
  return (
    <>
      <div className={section}>
        <p className="text-small font-semibold">Préréglages</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button key={p.name} type="button" onClick={() => onChange({ ...p.theme })} className="flex h-9 items-center gap-2 rounded-control border border-frame px-2 text-small hover:bg-field">
              <span aria-hidden className="size-4 rounded-full border border-frame" style={{ background: `linear-gradient(135deg, ${p.theme.background} 50%, ${p.theme.accent} 50%)` }} />
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className={section}>
        {color("accent", "Accent")}
        {color("background", "Fond")}
        {color("ink", "Texte")}
      </div>
      <div className={section}>
        <Select label="Police" value={t.font} options={Object.entries(FONT_LABEL).map(([value, label]) => ({ value, label }))} onChange={(e) => onChange({ ...t, font: e.target.value as Font })} />
        <label className="flex flex-col gap-2 text-small font-semibold">
          Arrondis : {t.radius} px
          <input type="range" min={0} max={32} value={t.radius} onChange={(e) => onChange({ ...t, radius: Number(e.target.value) })} className="accent-accent" />
        </label>
      </div>
    </>
  );
}

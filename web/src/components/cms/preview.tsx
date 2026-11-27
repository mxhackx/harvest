/* Le site du client tel qu'il s'affichera. Ses couleurs viennent de son thème (données), pas des jetons de Hivation. */
import type { CSSProperties } from "react";
import type { Block, SiteTheme } from "@/lib/cms/site";

const FONTS = { sans: "var(--font-sans)", display: "var(--font-display)", serif: "Georgia, 'Times New Roman', serif", mono: "var(--font-mono)" };

export const themeStyle = (t: SiteTheme): CSSProperties =>
  ({ "--s-accent": t.accent, "--s-bg": t.background, "--s-ink": t.ink, "--s-radius": `${t.radius}px`, background: t.background, color: t.ink, fontFamily: FONTS[t.font] }) as CSSProperties;

const button = "inline-block rounded-[var(--s-radius)] bg-[var(--s-accent)] px-5 py-3 text-body font-semibold text-[var(--s-bg)]";
// <img> simple : les photos sont des data URL locales
/* eslint-disable @next/next/no-img-element */

export function BlockView({ block: b }: { block: Block }) {
  if (b.type === "hero")
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        {b.logo ? <img src={b.logo} alt="Logo" className="size-16 rounded-full object-cover" /> : <span className="grid size-16 place-items-center rounded-full border border-dashed border-current text-caption opacity-60">Logo</span>}
        <h1 className="text-hero-sm font-bold leading-hero">{b.title}</h1>
        <p className="opacity-75">{b.text}</p>
        {b.image.src && <img src={b.image.src} alt={b.image.alt} className="w-full rounded-[var(--s-radius)] object-cover" />}
        {b.button && <span className={button}>{b.button}</span>}
      </div>
    );
  if (b.type === "menu")
    return (
      <div className="px-6 py-10">
        <h2 className="mb-5 text-heading font-bold">{b.title}</h2>
        <ul className="flex flex-col gap-4">
          {b.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-4 border-b border-current/15 pb-3">
              <span>
                <span className="block font-semibold">{it.name}</span>
                <span className="block text-small opacity-70">{it.description}</span>
              </span>
              <span className="whitespace-nowrap font-semibold text-[var(--s-accent)]">{Number(it.price || 0).toLocaleString("fr-FR")} F</span>
            </li>
          ))}
        </ul>
      </div>
    );
  if (b.type === "gallery")
    return (
      <div className="px-6 py-10">
        <h2 className="mb-5 text-heading font-bold">{b.title}</h2>
        <div className="grid grid-cols-2 gap-2">
          {b.photos.length === 0
            ? [0, 1, 2, 3].map((i) => <span key={i} className="aspect-square rounded-[var(--s-radius)] border border-dashed border-current/30" />)
            : b.photos.map((p, i) => <img key={i} src={p.src} alt={p.alt} className="aspect-square w-full rounded-[var(--s-radius)] object-cover" />)}
        </div>
      </div>
    );
  if (b.type === "contact")
    return (
      <div className="px-6 py-10">
        <h2 className="mb-3 text-heading font-bold">{b.title}</h2>
        <p>{b.address}</p>
        <p className="opacity-75">{b.hours}</p>
        <p className="mt-2 font-semibold text-[var(--s-accent)]">{b.phone || "Téléphone à renseigner"}</p>
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <h2 className="text-lead font-semibold">{b.title}</h2>
      <span className={button}>{b.button}</span>
    </div>
  );
}

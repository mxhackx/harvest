"use client";

import { useState } from "react";
import { resizeLogo } from "@/lib/company";

/** La photo de l'entreprise, ou ses initiales tant qu'elle n'en a pas. */
export function CompanyLogo({ name, logo, size = 40 }: { name: string; logo: string; size?: number }) {
  const style = { width: size, height: size };
  // data URL locale : next/image n'a rien à optimiser
  // eslint-disable-next-line @next/next/no-img-element
  if (logo) return <img src={logo} alt="" style={style} className="shrink-0 rounded-control border border-frame object-cover" />;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return (
    <span aria-hidden style={style} className="flex shrink-0 items-center justify-center rounded-control border border-frame bg-forest-soft text-small font-semibold text-link">
      {initials}
    </span>
  );
}

/** Choisir la photo depuis l'appareil : elle est réduite ici, puis envoyée avec le reste du formulaire. */
export function LogoPicker({ name, value, onChange, disabled }: { name: string; value: string; onChange: (logo: string) => void; disabled?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      onChange(await resizeLogo(file));
    } catch {
      setError("Image illisible : choisissez un fichier PNG, JPEG ou WebP.");
    }
  };
  return (
    <div className="flex items-center gap-4">
      <CompanyLogo name={name} logo={value} size={64} />
      <div className="flex flex-col gap-1">
        <p className="text-small font-semibold">Photo ou logo</p>
        {!disabled && (
          <div className="flex gap-3">
            <label className="cursor-pointer text-small font-medium text-link underline focus-within:outline-2 focus-within:outline-accent">
              {value ? "Changer" : "Choisir une image"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Photo ou logo" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {value && <button type="button" className="text-small text-muted underline" onClick={() => onChange("")}>Retirer</button>}
          </div>
        )}
        {error && <p className="text-small text-fail">{error}</p>}
      </div>
    </div>
  );
}

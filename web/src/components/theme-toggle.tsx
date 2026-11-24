"use client";

import { useThemeMode, type ThemeMode } from "@/lib/theme-mode";

const CHOICES: { mode: ThemeMode; label: string }[] = [
  { mode: "light", label: "Clair" },
  { mode: "dark", label: "Sombre" },
  { mode: "system", label: "Auto" },
];

/** Choix du thème (clair, sombre, selon l'appareil), dans le menu du compte. */
export function ThemeToggle() {
  const [mode, setMode] = useThemeMode();
  return (
    <div role="group" aria-label="Thème" className="flex gap-1 rounded-control bg-field p-1">
      {CHOICES.map((c) => (
        <button
          key={c.mode}
          type="button"
          aria-pressed={mode === c.mode}
          onClick={() => setMode(c.mode)}
          className={`h-8 flex-1 rounded-micro text-small font-medium ${mode === c.mode ? "bg-card text-ink" : "text-muted hover:text-ink"}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

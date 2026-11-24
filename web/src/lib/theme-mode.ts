"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/** Choix de l'utilisateur ; « system » suit le réglage de l'appareil. */
export type ThemeMode = "system" | "light" | "dark";

const KEY = "hivation.theme";
const listeners = new Set<() => void>();

export const parseMode = (raw: string | null): ThemeMode => (raw === "light" || raw === "dark" ? raw : "system");
export const resolveTheme = (mode: ThemeMode, systemDark: boolean): "light" | "dark" => (mode === "system" ? (systemDark ? "dark" : "light") : mode);

/** Exécuté avant l'affichage (balise script du layout) pour éviter un éclair de thème clair. Même logique que resolveTheme. */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${KEY}");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

const read = (): ThemeMode => {
  try {
    return parseMode(localStorage.getItem(KEY));
  } catch {
    return "system";
  }
};

const apply = (mode: ThemeMode) => {
  document.documentElement.dataset.theme = resolveTheme(mode, matchMedia("(prefers-color-scheme: dark)").matches);
};

export function useThemeMode() {
  const mode = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "system" as ThemeMode,
  );
  const setMode = useCallback((next: ThemeMode) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* stockage indisponible : le choix vaut pour cette page seulement */
    }
    apply(next);
    listeners.forEach((l) => l());
  }, []);
  return [mode, setMode] as const;
}

/** Suit le réglage de l'appareil quand le choix est « system ». Se monte une fois, dans le layout. */
export function ThemeSync() {
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(read());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return null;
}

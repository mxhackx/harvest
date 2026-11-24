/**
 * Couleurs lues par du code qui ne peut pas utiliser une classe CSS : cartes (MapLibre), aperçu de partage (rendu hors
 * navigateur), balise themeColor. La source reste globals.css ; theme.test.ts vérifie que les copies ci-dessous suivent.
 */

/** Valeur d'un jeton CSS (ex. « --color-route »), lue dans le navigateur. Hors navigateur, renvoie `fallback`. */
export function cssVar(name: string, fallback = ""): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Copies pour le code serveur (themeColor, image de partage) : mêmes valeurs que --color-accent, --color-ink, --color-muted, --color-page. */
export const THEME = {
  accent: "#0868c9",
  ink: "#14222e",
  muted: "#5a6b78",
  page: "#ffffff",
} as const;

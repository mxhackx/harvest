/**
 * Identité de la marque : le seul endroit où le nom du produit est écrit.
 * Changer `name` change l'interface, les titres, le référencement et la documentation du site.
 * (Les e-mails, côté API, lisent `api/src/brand.ts` ; le logo : `public/logo.svg` (couleur), `src/app/favicon.ico` et `icon.png` (onglet : hexagone robot seul), plus les PNG `public/logo.png`, `icon-192.png`, `icon-512.png` et `src/app/apple-icon.png`.)
 */
export const BRAND = {
  name: "Hivation",
} as const;

/**
 * Identité de la marque : le seul endroit où le nom du produit est écrit.
 * Changer `name` change l'interface, les titres, le référencement et la documentation du site.
 * (Les e-mails, côté API, lisent `api/src/brand.ts` ; le logo est dans `public/` et `src/app/opengraph-image.tsx`.)
 */
export const BRAND = {
  name: "Hivation",
} as const;

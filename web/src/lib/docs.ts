export type DocPage = { href: string; title: string; description: string; children?: DocPage[] };

/** Arborescence de la documentation : source unique pour le menu, le sitemap, les liens précédent/suivant. */
export const DOCS: DocPage[] = [
  {
    href: "/docs",
    title: "Présentation",
    description: "Ce que fait Harvest et où trouver chaque guide : import, export et localisation des leads.",
  },
  {
    href: "/docs/import",
    title: "Importer des leads",
    description: "Ajoutez plusieurs leads d'un coup depuis un fichier CSV ou JSON : étapes, limites, doublons et rapport d'analyse.",
    children: [
      {
        href: "/docs/import/csv",
        title: "Format CSV",
        description: "Comment présenter un fichier CSV : séparateurs, encodage, guillemets, en-têtes et exemples prêts à copier.",
      },
      {
        href: "/docs/import/json",
        title: "Format JSON",
        description: "Comment présenter un fichier JSON : structure attendue, types des valeurs et exemples prêts à copier.",
      },
      {
        href: "/docs/import/champs",
        title: "Champs acceptés",
        description: "Référence de tous les champs d'un lead : type, valeurs acceptées, noms de colonnes alternatifs et exemples.",
      },
      {
        href: "/docs/import/erreurs",
        title: "Messages d'erreur",
        description: "Les messages du rapport d'import : ce qu'ils signifient et comment corriger votre fichier.",
      },
    ],
  },
  {
    href: "/docs/export",
    title: "Exporter des leads",
    description: "Exportez vos leads en CSV ou JSON : formats, colonnes, droits requis et réimport.",
  },
  {
    href: "/docs/localisation",
    title: "Position sur la carte",
    description: "Comment un lead est placé sur la carte : coordonnées, lien Google Maps, adresse, et précision de la position.",
  },
];

/** Toutes les pages à plat, dans l'ordre de lecture. */
export const flattenDocs = (pages: DocPage[] = DOCS): DocPage[] => pages.flatMap((p) => [p, ...flattenDocs(p.children ?? [])]);

export const findDoc = (href: string) => flattenDocs().find((p) => p.href === href);

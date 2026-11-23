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
    href: "/docs/pipeline",
    title: "Pipeline et étapes",
    description: "Personnalisez les étapes de votre pipeline : noms, couleurs, probabilités, étapes gagnées et perdues, motif de perte et valeur pondérée.",
  },
  {
    href: "/docs/fiche-lead",
    title: "La fiche d'un lead",
    description: "Tout sur un lead au même endroit : étape, informations, fil d'activité, notes, appels, contacts multiples et attribution.",
  },
  {
    href: "/docs/taches",
    title: "Tâches et rappels",
    description: "Créez des tâches avec échéance, confiez-les à un collègue, repérez les retards et suivez les notifications de la cloche.",
  },
  {
    href: "/docs/equipe",
    title: "Équipe, rôles et invitations",
    description: "Invitez des collaborateurs par lien, gérez rôles et équipes, réattribuez des leads et passez d'une entreprise à l'autre.",
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

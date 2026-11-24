import { BRAND } from "./brand";
export type DocPage = { href: string; title: string; description: string; children?: DocPage[] };

/** Arborescence de la documentation : source unique pour le menu, le sitemap, les liens précédent/suivant. */
export const DOCS: DocPage[] = [
  {
    href: "/docs",
    title: "Présentation",
    description: `Ce que fait ${BRAND.name} et où trouver chaque guide : import, export et localisation des leads.`,
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
        href: "/docs/import/fields",
        title: "Champs acceptés",
        description: "Référence de tous les champs d'un lead : type, valeurs acceptées, noms de colonnes alternatifs et exemples.",
      },
      {
        href: "/docs/import/errors",
        title: "Messages d'erreur",
        description: "Les messages du rapport d'import : ce qu'ils signifient et comment corriger votre fichier.",
      },
    ],
  },
  {
    href: "/docs/waves",
    title: "Vagues et régions",
    description: "Couvrez une région à la fois : définissez vos régions, planifiez des vagues avec un objectif de visites, suivez l'avancement et clôturez avec un bilan.",
  },
  {
    href: "/docs/pipeline",
    title: "Pipeline et étapes",
    description: "Personnalisez les étapes de votre pipeline : noms, couleurs, probabilités, étapes gagnées et perdues, motif de perte et valeur pondérée.",
  },
  {
    href: "/docs/lead",
    title: "La fiche d'un lead",
    description: "Tout sur un lead au même endroit : étape, informations, fil d'activité, notes, appels, contacts multiples et attribution.",
  },
  {
    href: "/docs/messages",
    title: "Contacts, modèles et segments",
    description: "Retrouvez toutes vos personnes à joindre, envoyez un message WhatsApp ou e-mail depuis un modèle, et enregistrez vos vues de leads.",
  },
  {
    href: "/docs/tasks",
    title: "Tâches et rappels",
    description: "Créez des tâches avec échéance, confiez-les à un collègue, repérez les retards et suivez les notifications de la cloche.",
  },
  {
    href: "/docs/objectives",
    title: "Objectifs par commercial",
    description: "Fixez pour chaque commercial un objectif mensuel de visites, de leads gagnés et de valeur gagnée, et suivez l'avancement réel mois par mois.",
  },
  {
    href: "/docs/calendar",
    title: "Calendrier et export .ics",
    description: "Planifiez visites, appels et relances avec une heure de début et de fin, puis exportez-les vers Google Agenda, Apple Calendrier ou Outlook.",
  },
  {
    href: "/docs/reports",
    title: "Rapports",
    description: "Lisez vos chiffres : pipeline en valeur, conversion par étape, motifs de perte et activité de chaque personne sur la période choisie.",
  },
  {
    href: "/docs/team",
    title: "Équipe, rôles et invitations",
    description: "Invitez des collaborateurs par lien, gérez rôles et équipes, réattribuez des leads et passez d'une entreprise à l'autre.",
  },
  {
    href: "/docs/export",
    title: "Exporter des leads",
    description: "Exportez vos leads en CSV ou JSON : formats, colonnes, droits requis et réimport.",
  },
  {
    href: "/docs/location",
    title: "Position sur la carte",
    description: "Comment un lead est placé sur la carte : coordonnées, lien Google Maps, adresse, et précision de la position.",
  },
];

/** Toutes les pages à plat, dans l'ordre de lecture. */
export const flattenDocs = (pages: DocPage[] = DOCS): DocPage[] => pages.flatMap((p) => [p, ...flattenDocs(p.children ?? [])]);

export const findDoc = (href: string) => flattenDocs().find((p) => p.href === href);

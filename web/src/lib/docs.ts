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
    href: "/docs/accounts",
    title: "Comptes et opportunités",
    description: "Regroupez plusieurs opportunités d'une même entreprise cliente dans un compte, avec la valeur en cours et la valeur gagnée.",
  },
  {
    href: "/docs/quotes",
    title: "Devis",
    description: "Préparez un devis pour une opportunité : lignes, taxe, validité, envoi, acceptation et impression en PDF.",
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
    href: "/docs/webhooks",
    title: "Webhooks",
    description: "Prévenez un autre outil dès qu'un lead est créé, modifié ou supprimé, avec un envoi JSON signé que votre serveur peut vérifier.",
  },
  {
    href: "/docs/offline",
    title: "Mode hors connexion",
    description: "Continuez à lire vos leads sur le terrain sans réseau, marquez des visites et ajoutez des notes : tout part au retour de la connexion.",
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
    href: "/docs/tours",
    title: "Tournées et itinéraires",
    description: "Choisissez les prospects à visiter en présentiel, calculez l'itinéraire entre eux, optimisez l'ordre et ouvrez-le dans votre GPS.",
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

// ---------- Centre d'aide : deux parties (usage / API), des collections, de la recherche ----------

export type DocSection = "guide" | "api";
export type Collection = { id: string; section: DocSection; title: string; description: string; hrefs: string[] };

export const SECTIONS: Record<DocSection, { title: string; description: string }> = {
  guide: { title: "Guide utilisateur", description: "Utiliser l'application au quotidien : prospecter par vagues, suivre ses leads, travailler en équipe." },
  api: { title: "API et intégrations", description: "Brancher d'autres outils : webhooks signés et formats de fichiers pour l'import." },
};

/** Chaque page de documentation appartient à exactement une collection (un test le vérifie). */
export const COLLECTIONS: Collection[] = [
  { id: "terrain", section: "guide", title: "Vagues et terrain", description: "Régions, vagues, carte, calendrier et tâches.", hrefs: ["/docs/waves", "/docs/tours", "/docs/location", "/docs/calendar", "/docs/tasks", "/docs/offline"] },
  { id: "leads", section: "guide", title: "Leads et clients", description: "La fiche d'un lead, le pipeline, les contacts et les messages.", hrefs: ["/docs/accounts", "/docs/lead", "/docs/quotes", "/docs/pipeline", "/docs/messages"] },
  { id: "donnees", section: "guide", title: "Importer et exporter", description: "Faire entrer vos leads existants, et en sortir vos données.", hrefs: ["/docs/import", "/docs/export"] },
  { id: "equipe", section: "guide", title: "Équipe et suivi", description: "Inviter, répartir, fixer des objectifs et lire les rapports.", hrefs: ["/docs/team", "/docs/objectives", "/docs/reports"] },
  { id: "webhooks", section: "api", title: "Webhooks", description: "Être prévenu en temps réel quand un lead change.", hrefs: ["/docs/webhooks"] },
  { id: "formats", section: "api", title: "Formats de fichiers", description: "Référence technique des fichiers CSV et JSON acceptés à l'import.", hrefs: ["/docs/import/csv", "/docs/import/json", "/docs/import/fields", "/docs/import/errors"] },
];

export const collectionOf = (href: string) => COLLECTIONS.find((c) => c.hrefs.includes(href));
export const pagesOf = (c: Collection): DocPage[] => c.hrefs.map((h) => findDoc(h)!);

/** Pages de la même collection, pour « Articles liés » (la page courante exclue). */
export const relatedTo = (href: string, limit = 5): DocPage[] => {
  const c = collectionOf(href);
  return c ? pagesOf(c).filter((p) => p.href !== href).slice(0, limit) : [];
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Recherche dans les titres et descriptions : toutes les expressions saisies doivent apparaître ; les titres passent d'abord. */
export function searchDocs(query: string, limit = 8): DocPage[] {
  const words = fold(query).split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return [];
  return flattenDocs()
    .filter((p) => p.href !== "/docs")
    .map((p) => ({ p, title: fold(p.title), text: fold(`${p.title} ${p.description}`) }))
    .filter((x) => words.every((w) => x.text.includes(w)))
    .sort((a, b) => Number(words.every((w) => b.title.includes(w))) - Number(words.every((w) => a.title.includes(w))))
    .slice(0, limit)
    .map((x) => x.p);
}

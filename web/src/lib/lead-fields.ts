/**
 * Description des champs d'import : source unique pour la documentation, le modèle téléchargeable et les tests.
 * Doit rester alignée sur `api/src/leads/import.ts` (IMPORT_FIELDS) : un test de bout en bout importe les
 * modèles publiés pour s'en assurer.
 */
export type FieldDoc = {
  key: string;
  label: string;
  required?: boolean;
  type: string;
  description: string;
  accepted?: string;
  aliases: string[];
  example: string;
};

export const FIELD_DOCS: FieldDoc[] = [
  { key: "name", label: "Nom", required: true, type: "texte (120 max)", description: "Nom de l'entreprise. Seul champ obligatoire.", aliases: ["nom", "entreprise", "company", "société", "raison sociale"], example: "Pharmacie Étoile" },
  { key: "sector", label: "Secteur", type: "texte (100 max)", description: "Secteur d'activité.", aliases: ["secteur", "activité"], example: "Santé" },
  { key: "contactName", label: "Contact", type: "texte (100 max)", description: "Nom de la personne à contacter.", aliases: ["contact", "interlocuteur"], example: "Mme Adjovi" },
  { key: "phone", label: "Téléphone", type: "texte (40 max)", description: "Numéro de téléphone, saisi librement.", aliases: ["téléphone", "tel", "mobile"], example: "+229 97 00 11 22" },
  { key: "whatsapp", label: "WhatsApp", type: "numéro", description: "Numéro WhatsApp. Espaces, tirets et parenthèses sont retirés ; « 00 » devient « + ».", accepted: "6 à 15 chiffres, « + » initial facultatif. Mettez l'indicatif pour que le lien WhatsApp fonctionne.", aliases: ["numéro whatsapp"], example: "+22997001122" },
  { key: "facebook", label: "Facebook", type: "lien ou identifiant", description: "Page Facebook.", accepted: "Un lien facebook.com / fb.com / fb.me, ou un identifiant comme @pharmacie.etoile.", aliases: ["page facebook", "fb"], example: "@pharmacie.etoile" },
  { key: "website", label: "Site web", type: "lien", description: "Site web. Le « https:// » est ajouté s'il manque.", accepted: "Adresse http ou https avec un nom de domaine.", aliases: ["site", "site web", "url"], example: "pharmacie-etoile.bj" },
  { key: "googleMapsUrl", label: "Lien Google Maps", type: "lien", description: "Lien de partage Google Maps. Si les coordonnées sont absentes, elles sont lues dans ce lien.", accepted: "Lien maps.app.goo.gl, goo.gl/maps ou google.com/maps. Tout autre domaine est refusé.", aliases: ["google maps", "maps", "lien maps"], example: "https://maps.app.goo.gl/AbCdEf123" },
  { key: "address", label: "Adresse", type: "texte (200 max)", description: "Rue ou quartier. Sert à placer le lead sur la carte si aucune coordonnée n'est fournie.", aliases: ["adresse", "rue"], example: "Rue 12.052, Haie Vive" },
  { key: "city", label: "Ville", type: "texte (100 max)", description: "Ville. Améliore la recherche d'adresse.", aliases: ["ville", "commune"], example: "Cotonou" },
  { key: "landmark", label: "Repère", type: "texte (200 max)", description: "Précision pour retrouver le lieu : point de repère, étage…", aliases: ["repère", "précisions"], example: "En face de la pharmacie, 2e étage" },
  { key: "lat", label: "Latitude", type: "nombre", description: "Latitude en degrés décimaux. À fournir avec la longitude.", accepted: "−90 à 90. Le point ou la virgule sont acceptés comme séparateur décimal.", aliases: ["latitude"], example: "6.3611" },
  { key: "lng", label: "Longitude", type: "nombre", description: "Longitude en degrés décimaux. À fournir avec la latitude.", accepted: "−180 à 180.", aliases: ["lon", "long", "longitude"], example: "2.4098" },
  { key: "estimatedValue", label: "Valeur estimée", type: "entier", description: "Valeur du contrat espéré, sans devise.", accepted: "Entier positif. Les espaces sont ignorés (« 150 000 »). Pas de décimales.", aliases: ["valeur", "valeur estimée", "montant"], example: "150000" },
  { key: "status", label: "Étape", type: "liste", description: "Étape du pipeline. « À visiter » si le champ est absent.", accepted: "to_visit · interested · mockup_sent · deposit_paid, ou en français : À visiter · Intéressé · Maquette envoyée · Acompte payé.", aliases: ["statut", "étape"], example: "Intéressé" },
  { key: "visited", label: "Déjà visité", type: "oui / non", description: "Marque le lead comme déjà visité (date du jour si « visitedAt » est absent).", accepted: "oui · non · true · false · 1 · 0.", aliases: ["visite", "visité", "déjà visité"], example: "oui" },
  { key: "visitedAt", label: "Date de visite", type: "date", description: "Date de la visite effectuée.", accepted: "AAAA-MM-JJ, ou date-heure ISO 8601 (2026-11-20T09:30:00Z).", aliases: ["date visite", "date de visite"], example: "2026-11-20" },
];

export const IGNORED_EXPORT_COLUMNS = ["id", "statusLabel", "locationSource", "owner", "createdAt", "updatedAt"];

export const SAMPLE_ROWS = [
  { name: "Boulangerie Soleil", sector: "Commerce", contactName: "Mme Adjovi", phone: "+229 97 00 11 22", whatsapp: "+22997001122", facebook: "@boulangerie.soleil", website: "boulangerie-soleil.bj", googleMapsUrl: "", address: "Rue 12.052, Cadjehoun", city: "Cotonou", landmark: "En face de la pharmacie", lat: "6.3654", lng: "2.3912", estimatedValue: "150000", status: "À visiter", visited: "non", visitedAt: "" },
  { name: "Pharmacie Étoile", sector: "Santé", contactName: "", phone: "", whatsapp: "", facebook: "", website: "", googleMapsUrl: "https://www.google.com/maps/place/Pharmacie/@6.3611,2.4098,17z", address: "Haie Vive", city: "Cotonou", landmark: "", lat: "", lng: "", estimatedValue: "320000", status: "Intéressé", visited: "oui", visitedAt: "2026-11-20" },
  { name: "Salon Prestige", sector: "Beauté", contactName: "Koffi", phone: "", whatsapp: "", facebook: "", website: "", googleMapsUrl: "", address: "Akpakpa", city: "Cotonou", landmark: "", lat: "", lng: "", estimatedValue: "", status: "Maquette envoyée", visited: "", visitedAt: "" },
];

const COLUMNS = FIELD_DOCS.map((f) => f.key);
const csvCell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export const SAMPLE_CSV = [COLUMNS.join(","), ...SAMPLE_ROWS.map((r) => COLUMNS.map((c) => csvCell(r[c as keyof typeof r] ?? "")).join(","))].join("\n") + "\n";

export const SAMPLE_JSON = JSON.stringify(
  SAMPLE_ROWS.map((r) => {
    const o: Record<string, string | number | boolean> = {};
    for (const c of COLUMNS) {
      const v = r[c as keyof typeof r];
      if (v === "" || v === undefined) continue;
      o[c] = c === "lat" || c === "lng" || c === "estimatedValue" ? Number(v) : c === "visited" ? v === "oui" : v;
    }
    return o;
  }),
  null,
  2,
) + "\n";

export const MINIMAL_CSV = "name\nPharmacie Étoile\nSalon Prestige\n";
export const MINIMAL_JSON = '[\n  { "name": "Pharmacie Étoile" },\n  { "name": "Salon Prestige" }\n]\n';

/** Exemples de la documentation, vérifiés par les tests : ils doivent toujours s'importer sans erreur. */
export const EXAMPLE_SEMICOLON_CSV = `nom;ville;téléphone;valeur estimée;étape
Pharmacie Étoile;Cotonou;+229 97 00 11 22;"150 000";Intéressé
"Salon ""Prestige"", Akpakpa";Cotonou;;;Maquette envoyée
`;

export const EXAMPLE_WRAPPED_JSON = `{
  "leads": [
    { "name": "Pharmacie Étoile", "city": "Cotonou" },
    { "name": "Salon Prestige", "city": "Cotonou" }
  ]
}
`;

export const EXAMPLE_FRENCH_JSON = `[
  { "nom": "Pharmacie Étoile", "ville": "Cotonou", "étape": "Intéressé", "valeur estimée": 150000 }
]
`;

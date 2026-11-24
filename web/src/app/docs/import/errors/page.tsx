import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/import/errors");

type Row = { message: string; cause: string; fix: string };

/** Fichier refusé en entier : l’analyse s’arrête et rien n’est importé. */
const FILE_ERRORS: Row[] = [
  { message: "Le fichier est vide.", cause: "Aucun contenu.", fix: "Choisissez le bon fichier ou collez son contenu." },
  { message: "Le CSV doit contenir une ligne d’en-tête puis au moins un lead.", cause: "Une seule ligne, ou aucune ligne de données.", fix: "Ajoutez les en-têtes sur la première ligne et les leads dessous." },
  { message: "Aucune colonne « name » (ou « nom ») dans l’en-tête : impossible d’identifier les leads.", cause: "La première ligne ne contient aucun nom de colonne reconnu pour le nom de l’entreprise.", fix: "Ajoutez une colonne name ou nom. Vérifiez aussi que la première ligne est bien l’en-tête." },
  { message: "CSV invalide : guillemet non refermé (le champ commence ligne N).", cause: "Une cellule commence par un guillemet qui n’est jamais refermé.", fix: "Fermez le guillemet à la ligne indiquée, ou doublez-le (\"\") s’il fait partie du texte." },
  { message: "JSON invalide : …", cause: "Le fichier n’est pas du JSON correct (virgule en trop, guillemets manquants…).", fix: "Validez votre JSON avec un outil en ligne ou votre éditeur de code, puis corrigez la ligne signalée." },
  { message: "Le JSON doit être un tableau de leads, ou un objet { \"leads\": [ … ] }.", cause: "Le JSON est valide mais a une autre forme.", fix: "Entourez vos leads d’un tableau [ … ], ou placez-les dans une clé leads." },
  { message: "Le fichier ne contient aucun lead.", cause: "Le tableau JSON est vide.", fix: "Ajoutez au moins un lead." },
  { message: "N lignes : la limite est de 1000 par import.", cause: "Le fichier dépasse 1 000 leads.", fix: "Découpez le fichier en plusieurs imports de 1 000 leads au plus." },
  { message: "Fichier trop volumineux : 1,5 Mo au plus.", cause: "Le fichier dépasse 1,5 Mo.", fix: "Découpez-le en plusieurs fichiers." },
];

/** Ligne refusée : elle est ignorée, les autres sont importées. Le rapport donne la ligne et le champ. */
const ROW_ERRORS: Row[] = [
  { message: "champ obligatoire (champ « name »)", cause: "Le nom de l’entreprise est vide.", fix: "Renseignez le nom, ou supprimez la ligne." },
  { message: "trop long (120 caractères au plus)", cause: "Un texte dépasse la longueur maximale du champ.", fix: "Raccourcissez-le. Les longueurs maximales sont indiquées dans les champs acceptés." },
  { message: "étape inconnue « … »", cause: `La valeur du champ status n’est pas une étape de ${BRAND.name}.`, fix: "Utilisez À visiter, Intéressé, Maquette envoyée ou Acompte payé (ou to_visit, interested, mockup_sent, deposit_paid)." },
  { message: "latitude et longitude vont ensemble", cause: "Une seule des deux coordonnées est renseignée.", fix: "Renseignez les deux, ou aucune des deux." },
  { message: "latitude invalide « … » / longitude invalide « … »", cause: "La valeur n’est pas un nombre.", fix: "Écrivez un nombre décimal : 6.3611 ou 6,3611." },
  { message: "latitude hors limites (−90 à 90) / longitude hors limites (−180 à 180)", cause: "Les coordonnées sont inversées ou fausses.", fix: "La latitude vient avant la longitude ; à Cotonou : lat 6.36, lng 2.42." },
  { message: "valeur invalide « … » (nombre entier positif attendu)", cause: "La valeur estimée n’est pas un entier positif.", fix: "Écrivez 150000 ou « 150 000 », sans devise ni décimales." },
  { message: "valeur « … » incompréhensible (oui/non, true/false)", cause: "Le champ visited ne contient ni oui, ni non.", fix: "Utilisez oui, non, true, false, 1 ou 0." },
  { message: "date de visite invalide « … » (format AAAA-MM-JJ attendu)", cause: "La date n’est pas lisible.", fix: "Écrivez la date au format 2026-11-20." },
  { message: "numéro WhatsApp invalide (6 à 15 chiffres)", cause: "Le numéro contient des lettres ou n’a pas entre 6 et 15 chiffres.", fix: "Écrivez le numéro avec l’indicatif : +22997001122." },
  { message: "lien ou identifiant Facebook invalide", cause: "Le lien ne mène pas à Facebook.", fix: "Collez le lien de la page (facebook.com/…) ou son identifiant : @ma.page." },
  { message: "adresse de site web invalide", cause: "Ce n’est pas une adresse web (http ou https, avec un nom de domaine).", fix: "Écrivez monsite.com ou https://monsite.com." },
  { message: "lien Google Maps invalide", cause: "Le lien n’est pas un lien de cartes Google.", fix: "Utilisez le lien « Partager » de Google Maps (maps.app.goo.gl/… ou google.com/maps/…)." },
  { message: "cette entrée n’est pas un objet JSON", cause: "Dans un tableau JSON, un élément est un nombre, du texte, une liste ou null.", fix: "Chaque élément doit être un objet { … }. Le rapport indique son numéro d’ordre dans le tableau." },
];

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Message</th>
            <th>Cause</th>
            <th>Que faire</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.message}>
              <td>{r.message}</td>
              <td>{r.cause}</td>
              <td>{r.fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  return (
    <DocArticle href="/docs/import/errors">
      <p>
        Le rapport d’analyse indique le numéro de la ligne concernée (ou, pour un JSON, le numéro de l’entrée) et le nom
        du champ. Corrigez le fichier et relancez l’analyse : tant que vous n’avez pas confirmé, rien n’est créé.
      </p>

      <h2>Fichier refusé en entier</h2>
      <p>Ces erreurs arrêtent l’analyse : aucun lead n’est lu.</p>
      <Table rows={FILE_ERRORS} />

      <h2>Ligne ignorée</h2>
      <p>
        Ces erreurs n’écartent que la ligne concernée. Les lignes valides sont importées, et les lignes ignorées sont
        listées dans le rapport.
      </p>
      <Table rows={ROW_ERRORS} />

      <h2>Doublons</h2>
      <p>
        Un doublon n’est pas une erreur : la ligne est simplement écartée parce que le lead existe déjà. Voir{" "}
        <Link href="/docs/import">Importer des leads</Link> pour la définition exacte.
      </p>

      <h2>Vous n’avez pas le droit</h2>
      <p>
        Le message « Vous n’avez pas le droit de faire cela » signifie que votre rôle ne permet pas de créer des leads.
        Demandez à un responsable de l’entreprise de vous donner ce droit.
      </p>
    </DocArticle>
  );
}

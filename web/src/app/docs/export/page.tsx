import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/export");

const COLUMNS: [string, string][] = [
  ["id", "Identifiant interne du lead."],
  ["name", "Nom de l’entreprise."],
  ["status", "Clé de l'étape du pipeline : to_visit, interested, mockup_sent, deposit_paid, won, lost, ou celle d'une étape que vous avez ajoutée."],
  ["statusLabel", "Nom de l'étape tel qu'il apparaît dans votre pipeline (À visiter, Intéressé, Gagné…)."],
  ["sector", "Secteur d’activité."],
  ["contactName", "Personne à contacter."],
  ["phone", "Téléphone."],
  ["whatsapp", "Numéro WhatsApp, au format international."],
  ["facebook", "Lien de la page Facebook."],
  ["website", "Site web."],
  ["googleMapsUrl", "Lien Google Maps."],
  ["address", "Adresse."],
  ["city", "Ville."],
  ["landmark", "Repère pour retrouver le lieu."],
  ["lat", "Latitude, vide si le lead n’a pas de position."],
  ["lng", "Longitude, vide si le lead n’a pas de position."],
  ["locationSource", "Origine de la position : manual (saisie), address (déduite de l’adresse), google_maps (lue dans le lien), vide si aucune."],
  ["estimatedValue", "Valeur estimée, entier."],
  ["visited", "true ou false."],
  ["visitedAt", "Date de la visite, au format ISO 8601, vide si pas encore visité."],
  ["lostReason", "Motif de perte, pour un lead dans une étape « perdu »."],
  ["closedAt", "Date d'entrée dans une étape « gagné » ou « perdu », ISO 8601."],
  ["owner", "Nom de la personne qui a créé le lead."],
  ["createdAt", "Date de création, ISO 8601."],
  ["updatedAt", "Date de dernière modification, ISO 8601."],
];

export default function Page() {
  return (
    <DocArticle href="/docs/export">
      <h2>Exporter</h2>
      <ol>
        <li>Ouvrez <strong>CRM › Leads</strong>.</li>
        <li>
          Pour exporter tout ce qui est affiché, cliquez sur <strong>Exporter</strong> dans la barre d’outils. Les
          recherches et filtres en cours sont pris en compte.
        </li>
        <li>
          Pour n’exporter que certains leads, cochez-les : une barre d’actions apparaît avec un menu{" "}
          <strong>Exporter</strong>.
        </li>
        <li>Choisissez le format.</li>
      </ol>

      <h2>Formats</h2>
      <ul>
        <li><strong>CSV</strong> : séparateur virgule, UTF-8 avec BOM. Convient à Google Sheets et aux outils de données.</li>
        <li><strong>CSV pour Excel français</strong> : séparateur point-virgule. À choisir si Excel affiche tout dans une seule colonne.</li>
        <li><strong>JSON</strong> : un tableau d’objets, avec les mêmes clés que les colonnes du CSV. Les nombres et booléens sont de vrais types JSON, les champs vides sont <code>null</code>.</li>
      </ul>

      <h2>Colonnes exportées</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Colonne</th>
              <th>Contenu</th>
            </tr>
          </thead>
          <tbody>
            {COLUMNS.map(([name, desc]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Qui peut exporter ?</h2>
      <p>
        L’export demande le droit <code>lead:export</code>. Par défaut, le CEO et le Manager l’ont ; les autres rôles
        non, mais il peut être ajouté à un rôle personnalisé. L’export respecte aussi la portée de vos droits : vous
        n’exportez jamais plus que ce que vous pouvez lire et exporter, et jamais les leads d’une autre entreprise.
      </p>

      <h2>Réimporter un export</h2>
      <p>
        Un fichier exporté se réimporte sans modification avec <Link href="/docs/import">l’import</Link>. Les colonnes
        calculées par Harvest (<code>id</code>, <code>statusLabel</code>, <code>locationSource</code>,{" "}
        <code>lostReason</code>, <code>closedAt</code>, <code>owner</code>, <code>createdAt</code>, <code>updatedAt</code>) sont ignorées. Réimporter dans la même
        entreprise ne crée rien : tous les leads sont des doublons.
      </p>

      <Callout title="Protection contre les formules">
        Une cellule qui commence par <code>=</code>, <code>+</code>, <code>-</code> ou <code>@</code> serait exécutée
        comme une formule par un tableur. À l’export, Harvest ajoute une apostrophe devant ces valeurs. Les numéros de
        téléphone comme <code>+22997001122</code> ne sont pas modifiés.
      </Callout>
    </DocArticle>
  );
}

import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { Callout, CodeBlock, DocArticle } from "@/components/docs/blocks";
import { EXAMPLE_SEMICOLON_CSV, MINIMAL_CSV, SAMPLE_CSV } from "@/lib/lead-fields";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/import/csv");

export default function Page() {
  return (
    <DocArticle href="/docs/import/csv">
      <h2>Les règles</h2>
      <ul>
        <li><strong>Première ligne = en-têtes.</strong> Chaque colonne porte le nom d’un <Link href="/docs/import/champs">champ</Link>.</li>
        <li><strong>Séparateur</strong> : virgule, point-virgule ou tabulation. {BRAND.name} le devine d’après la première ligne.</li>
        <li><strong>Encodage</strong> : UTF-8 (avec ou sans BOM). Les accents sont conservés.</li>
        <li><strong>Une colonne <code>name</code> est obligatoire</strong> (ou <code>nom</code>). Les autres colonnes sont facultatives.</li>
        <li><strong>Ordre libre</strong> : les colonnes peuvent être dans n’importe quel ordre.</li>
        <li><strong>Colonnes inconnues</strong> : ignorées, et signalées dans le rapport.</li>
        <li><strong>Lignes vides</strong> : ignorées.</li>
        <li><strong>Cellule vide</strong> : le champ n’est pas renseigné.</li>
      </ul>

      <h2>Guillemets</h2>
      <p>
        Une cellule qui contient le séparateur, un guillemet ou un saut de ligne doit être entourée de guillemets
        doubles. Un guillemet à l’intérieur se double : <code>{'"Salon ""Prestige"", Akpakpa"'}</code>. Les tableurs le
        font automatiquement à l’enregistrement.
      </p>

      <h2>Exemple minimal</h2>
      <p>Une seule colonne suffit :</p>
      <CodeBlock lang="csv" label="leads-minimal.csv" code={MINIMAL_CSV} />

      <h2>Exemple complet</h2>
      <p>Toutes les colonnes acceptées, avec trois leads :</p>
      <CodeBlock lang="csv" label="leads-modele.csv" code={SAMPLE_CSV} />
      <p>
        <a href="/templates/leads-modele.csv" download>Télécharger ce modèle</a> pour partir d’un fichier prêt à
        remplir.
      </p>

      <h2>Noms de colonnes en français</h2>
      <p>
        Les noms français sont acceptés, avec ou sans accents, en majuscules ou en minuscules. Le point-virgule est
        détecté tout seul :
      </p>
      <CodeBlock lang="csv" label="exemple en français" code={EXAMPLE_SEMICOLON_CSV} />

      <h2>Depuis Excel ou Google Sheets</h2>
      <ol>
        <li>Mettez une colonne par champ, avec les en-têtes sur la première ligne.</li>
        <li>
          <strong>Excel</strong> : <em>Fichier › Enregistrer sous › CSV UTF-8 (délimité par des virgules)</em>. Sur un
          Excel en français, le format « CSV (séparateur : point-virgule) » fonctionne aussi.
        </li>
        <li><strong>Google Sheets</strong> : <em>Fichier › Télécharger › Valeurs séparées par des virgules (.csv)</em>.</li>
      </ol>

      <h2>Valeurs particulières</h2>
      <ul>
        <li><strong>Étape</strong> : <code>to_visit</code>, <code>interested</code>, <code>mockup_sent</code>, <code>deposit_paid</code>, ou en français « À visiter », « Intéressé », « Maquette envoyée », « Acompte payé ».</li>
        <li><strong>Oui / non</strong> : <code>oui</code>, <code>non</code>, <code>true</code>, <code>false</code>, <code>1</code>, <code>0</code>.</li>
        <li><strong>Nombres</strong> : la virgule décimale est acceptée pour les coordonnées (<code>6,3611</code>). La valeur estimée est un entier : « 150 000 » et « 150000 » sont équivalents.</li>
        <li><strong>Dates</strong> : <code>AAAA-MM-JJ</code>, par exemple <code>2026-11-20</code>.</li>
      </ul>

      <Callout title="Avertissement : formules">
        Un nom qui commence par <code>=</code>, <code>+</code>, <code>-</code> ou <code>@</code> est importé tel quel
        comme du texte. À l’export, {BRAND.name} ajoute une apostrophe devant pour qu’un tableur ne l’exécute jamais comme
        une formule.
      </Callout>
    </DocArticle>
  );
}

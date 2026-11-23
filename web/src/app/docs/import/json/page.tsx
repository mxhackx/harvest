import Link from "next/link";
import { Callout, CodeBlock, DocArticle } from "@/components/docs/blocks";
import { EXAMPLE_FRENCH_JSON, EXAMPLE_WRAPPED_JSON, MINIMAL_JSON, SAMPLE_JSON } from "@/lib/lead-fields";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/import/json");

export default function Page() {
  return (
    <DocArticle href="/docs/import/json">
      <h2>Structure attendue</h2>
      <p>Le fichier contient soit :</p>
      <ul>
        <li>un <strong>tableau</strong> de leads : <code>{"[ { … }, { … } ]"}</code> ;</li>
        <li>soit un <strong>objet</strong> avec une clé <code>leads</code> qui contient ce tableau : <code>{'{ "leads": [ … ] }'}</code>.</li>
      </ul>
      <p>
        Chaque lead est un objet « à plat » : une clé par <Link href="/docs/import/champs">champ</Link>, sans objet
        imbriqué. Seule la clé <code>name</code> est obligatoire.
      </p>

      <h2>Exemple minimal</h2>
      <CodeBlock lang="json" label="leads-minimal.json" code={MINIMAL_JSON} />

      <h2>Exemple complet</h2>
      <p>Toutes les clés acceptées, avec trois leads :</p>
      <CodeBlock lang="json" label="leads-modele.json" code={SAMPLE_JSON} />
      <p>
        <a href="/templates/leads-modele.json" download>Télécharger ce modèle</a> pour partir d’un fichier prêt à
        remplir.
      </p>

      <h2>Variante avec une clé « leads »</h2>
      <CodeBlock lang="json" label="leads.json" code={EXAMPLE_WRAPPED_JSON} />

      <h2>Types des valeurs</h2>
      <ul>
        <li><strong>Texte</strong> : une chaîne de caractères. Les espaces autour sont retirés.</li>
        <li><strong>Nombres</strong> : <code>lat</code>, <code>lng</code> et <code>estimatedValue</code> peuvent être de vrais nombres JSON (<code>6.3611</code>) ou des chaînes (<code>{'"6.3611"'}</code>). La valeur estimée est un entier.</li>
        <li><strong>Oui / non</strong> : <code>visited</code> accepte <code>true</code> ou <code>false</code>.</li>
        <li><strong>Absent ou <code>null</code></strong> : le champ n’est pas renseigné.</li>
        <li><strong>Dates</strong> : <code>visitedAt</code> en <code>AAAA-MM-JJ</code> ou en date-heure ISO 8601.</li>
      </ul>

      <h2>Noms de clés en français</h2>
      <p>Les noms français sont acceptés, avec ou sans accents :</p>
      <CodeBlock lang="json" label="exemple en français" code={EXAMPLE_FRENCH_JSON} />

      <Callout title="Clés inconnues">
        Une clé que Harvest ne connaît pas est ignorée et signalée dans le rapport d’analyse. Une entrée qui n’est pas un
        objet (un nombre, une liste, <code>null</code>) est rejetée avec son numéro d’ordre dans le tableau.
      </Callout>

      <h2>Encodage</h2>
      <p>UTF-8. Un BOM en tête de fichier est toléré.</p>
    </DocArticle>
  );
}

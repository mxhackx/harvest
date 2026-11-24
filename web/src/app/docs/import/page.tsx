import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";
import { TEMPLATES } from "@/lib/templates";

export const metadata = docMetadata("/docs/import");

export default function Page() {
  return (
    <DocArticle href="/docs/import">
      <h2>En bref</h2>
      <ul>
        <li>Deux formats : <Link href="/docs/import/csv">CSV</Link> et <Link href="/docs/import/json">JSON</Link>.</li>
        <li>Jusqu’à 1 000 leads par import et 1,5 Mo par fichier.</li>
        <li>Une analyse précède toujours l’import : rien n’est créé tant que vous n’avez pas confirmé.</li>
        <li>Les lignes invalides et les doublons sont écartés et listés ; les autres sont importés.</li>
      </ul>

      <h2>Importer, étape par étape</h2>
      <ol>
        <li>Ouvrez <strong>CRM › Leads</strong>, puis cliquez sur <strong>Importer</strong>.</li>
        <li>Choisissez votre fichier, ou collez son contenu dans la zone de texte.</li>
        <li>Cliquez sur <strong>Analyser</strong>. {BRAND.name} lit le fichier et prépare un rapport, sans rien créer.</li>
        <li>Lisez le rapport : nombre de leads à importer, doublons, lignes invalides et aperçu des premiers leads.</li>
        <li>Cliquez sur <strong>Importer N leads</strong> pour confirmer.</li>
      </ol>
      <p>
        Si le rapport signale des erreurs, vous pouvez soit importer les lignes valides telles quelles, soit corriger
        votre fichier et recommencer : <Link href="/docs/import/errors">les messages d’erreur</Link> indiquent le
        numéro de ligne et le champ concerné.
      </p>

      <h2>Ce que contient le rapport d’analyse</h2>
      <ul>
        <li><strong>À importer</strong> : les leads qui seront créés.</li>
        <li><strong>Invalides ignorées</strong> : les lignes qui ne respectent pas le format, avec leur numéro de ligne.</li>
        <li><strong>Doublons ignorés</strong> : voir ci-dessous.</li>
        <li><strong>Colonnes non reconnues</strong> : les colonnes de votre fichier que {BRAND.name} ne connaît pas. Elles sont ignorées.</li>
        <li><strong>Aperçu</strong> : les cinq premiers leads tels qu’ils seront créés.</li>
      </ul>

      <h2>Doublons</h2>
      <p>
        Un lead est un doublon quand un autre lead que vous pouvez voir, ou une autre ligne du même fichier, a le même{" "}
        <strong>nom</strong>, le même <strong>téléphone</strong> et la même <strong>adresse</strong>. La casse, les
        espaces et la mise en forme du téléphone sont ignorés. Deux « Pharmacie » d’adresses différentes ne sont donc
        pas des doublons. Importer deux fois le même fichier ne crée rien la seconde fois.
      </p>

      <h2>À qui appartiennent les leads importés ?</h2>
      <p>
        Aux personnes qui importent, dans leur équipe : ils suivent ensuite les mêmes règles de visibilité que les
        leads créés à la main. Il faut avoir le droit de créer des leads pour importer.
      </p>

      <h2>Position sur la carte</h2>
      <p>
        Les leads importés apparaissent sur la carte dès qu’ils ont une position. Si le fichier ne contient pas de
        coordonnées, {BRAND.name} les cherche à partir du lien Google Maps ou de l’adresse. Cette recherche se fait en
        arrière-plan, un lead à la fois : les points arrivent sur la carte au fil de l’eau, sans vous faire attendre.
        Voir <Link href="/docs/location">Position sur la carte</Link>.
      </p>

      <h2>Modèles à télécharger</h2>
      <ul>
        {Object.entries(TEMPLATES).map(([name, t]) => (
          <li key={name}>
            <a href={`/templates/${name}`} download>
              {t.label}
            </a>{" "}
            (<code>{name}</code>)
          </li>
        ))}
      </ul>

      <Callout title={`Un export ${BRAND.name} se réimporte tel quel`}>
        Les fichiers produits par <Link href="/docs/export">l’export</Link> peuvent être importés sans modification,
        par exemple pour copier des leads d’une entreprise à une autre. Les colonnes propres à l’export (identifiant,
        propriétaire, dates) sont reconnues et ignorées.
      </Callout>
    </DocArticle>
  );
}

import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/pipeline");

export default function Page() {
  return (
    <DocArticle href="/docs/pipeline">
      <h2>En bref</h2>
      <ul>
        <li>Chaque entreprise a son propre pipeline : une suite d’étapes que vos leads traversent.</li>
        <li>Six étapes sont créées par défaut : À visiter, Intéressé, Maquette envoyée, Acompte payé, Gagné, Perdu.</li>
        <li>Vous pouvez renommer, recolorer, réordonner, ajouter (jusqu’à 20) ou supprimer des étapes.</li>
      </ul>

      <h2>Modifier le pipeline</h2>
      <p>
        Ouvrez <strong>CRM › Pipeline</strong>. Pour chaque étape, réglez le nom, la couleur, la probabilité et le type,
        puis enregistrez. Les flèches changent l’ordre des colonnes du tableau de leads. Il faut le droit de modifier les
        étapes (par défaut : CEO et Manager).
      </p>

      <h2>Les trois types d’étape</h2>
      <ul>
        <li><strong>En cours</strong> : le lead est encore à travailler. Il compte dans la valeur du pipeline.</li>
        <li><strong>Gagnée</strong> : le lead est signé. Sa date de clôture est enregistrée.</li>
        <li><strong>Perdue</strong> : le lead est abandonné. {BRAND.name} propose d’indiquer le motif de perte.</li>
      </ul>
      <p>Il faut toujours garder au moins une étape « en cours ».</p>

      <h2>Probabilité et valeur pondérée</h2>
      <p>
        La probabilité (0 à 100 %) est la chance de conclure à cette étape. La valeur pondérée du pipeline est la somme,
        pour les leads en cours, de leur valeur estimée multipliée par la probabilité de leur étape. Les étapes gagnées et
        perdues n’y entrent pas.
      </p>

      <h2>Supprimer une étape utilisée</h2>
      <p>
        Une étape qui contient des leads ne se supprime pas telle quelle : {BRAND.name} demande vers quelle autre étape les
        déplacer. Rien n’est perdu en route.
      </p>

      <Callout title="Import et export">
        Dans les fichiers, l’étape s’écrit avec sa clé (<code>to_visit</code>…) ou son nom exact. Voir{" "}
        <Link href="/docs/import/fields">les champs acceptés</Link>.
      </Callout>
    </DocArticle>
  );
}

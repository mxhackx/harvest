import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/rapports");

export default function Page() {
  return (
    <DocArticle href="/docs/rapports">
      <h2>En bref</h2>
      <p>
        <strong>CRM › Rapports</strong> répond à trois questions : combien vaut mon pipeline, où perd-on des leads, et
        qui fait quoi. La période se règle en haut de la page (7 jours, 30 jours, 90 jours, 12 mois).
      </p>

      <h2>Les quatre chiffres du haut</h2>
      <ul>
        <li><strong>Pipeline ouvert</strong> : somme des valeurs estimées des leads encore en cours. Indépendant de la période.</li>
        <li><strong>Valeur pondérée</strong> : chaque valeur multipliée par la probabilité de son étape (voir <Link href="/docs/pipeline">Pipeline et étapes</Link>).</li>
        <li><strong>Gagné sur la période</strong> : leads passés en « gagné » pendant la période, et leur valeur.</li>
        <li><strong>Taux de réussite</strong> : gagnés ÷ (gagnés + perdus), parmi les leads créés sur la période. Les leads encore en cours ne le font pas baisser.</li>
      </ul>

      <h2>Conversion par étape</h2>
      <p>
        On prend les leads <strong>créés sur la période</strong> (la cohorte) et on compte, pour chaque étape, combien
        l’ont atteinte : ils y sont ou y sont passés. Deux taux : la part de la cohorte, et le taux depuis l’étape
        précédente (le plus utile pour voir où l’on perd du monde). Un lead passé directement à « Gagné » compte aux
        étapes qu’il a sautées, pour que les taux ne dépassent jamais 100 %.
      </p>

      <h2>Motifs de perte</h2>
      <p>Les raisons saisies quand un lead passe en « perdu », classées par fréquence. « Non précisé » regroupe les pertes sans motif.</p>

      <h2>Activité par personne</h2>
      <p>
        Pour chaque personne : leads créés, appels, messages, visites, e-mails, notes, changements d’étape, tâches
        terminées, leads gagnés et leur valeur. Ces chiffres viennent du <Link href="/docs/fiche-lead">fil d’activité</Link> :
        ils ne valent que ce qui y est saisi.
      </p>

      <Callout title="Qui voit quoi ?">
        Les rapports portent sur les leads que vous avez le droit de lire. Un Prospecteur voit uniquement ses propres
        chiffres ; un Manager ou un CEO voit toute l’entreprise.
      </Callout>
    </DocArticle>
  );
}

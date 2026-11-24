import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/objectives");

export default function Page() {
  return (
    <DocArticle href="/docs/objectives">
      <h2>Fixer les objectifs du mois</h2>
      <p>
        Dans <strong>CRM › Objectifs</strong>, choisissez le mois, puis <strong>Fixer les objectifs</strong> pour une
        personne : un nombre de <strong>visites</strong>, de <strong>leads gagnés</strong> et une <strong>valeur
        gagnée</strong>. Laissez 0 pour un point sans objectif. Fixer les objectifs de l’équipe demande le droit
        « objective » (CEO et Manager par défaut).
      </p>

      <h2>Comment l’avancement est compté</h2>
      <ul>
        <li><strong>Visites</strong> : les notes de type « visite » et les passages à « visité » faits par la personne dans le mois.</li>
        <li><strong>Leads gagnés</strong> et <strong>valeur gagnée</strong> : les leads dont elle est responsable, passés dans une étape « gagné » dans le mois (valeur estimée du lead).</li>
      </ul>

      <Callout title="Qui voit quoi ?">
        Chacun voit ses propres objectifs. Ceux qui peuvent consulter les membres de l’entreprise voient toute l’équipe.
      </Callout>
    </DocArticle>
  );
}

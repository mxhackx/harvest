import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/waves");

export default function Page() {
  return (
    <DocArticle href="/docs/waves">
      <p>
        Une <strong>vague</strong> est une région couverte pendant une période, avec un objectif de visites. Elle répond à
        la question que se pose toute équipe de terrain : <em>quelle région est faite, laquelle reste ?</em> Tout se règle
        dans la section <strong>Vagues</strong> du menu.
      </p>

      <h2>1. Définir ses régions</h2>
      <p>
        Dans <strong>Vagues › Régions</strong>, créez une région : un nom, un <strong>centre</strong> (cliquez sur la
        carte) et un <strong>rayon</strong> en kilomètres. Vous n’avez jamais à ranger un lead à la main : {BRAND.name} le
        place dans la région qui contient sa position (voir <Link href="/docs/location">Position sur la carte</Link>). Si
        deux régions se recouvrent, le lead va dans celle dont le centre est le plus proche. Un lead sans position n’a
        pas de région.
      </p>
      <p>
        Déplacer ou agrandir une région, ou créer une nouvelle région sur des leads existants, range à nouveau les leads
        concernés tout de suite.
      </p>

      <h2>2. Planifier une vague</h2>
      <p>
        Dans <strong>Vagues › Vagues</strong>, cliquez sur <strong>Nouvelle vague</strong> : choisissez la région, une date
        de début et de fin, et un <strong>objectif de visites</strong> (0 si vous n’en voulez pas). Chaque vague est dans
        l’un de ces états :
      </p>
      <ul>
        <li><strong>À venir</strong> : la période n’a pas commencé.</li>
        <li><strong>En cours</strong> : on est dans la période.</li>
        <li><strong>En retard</strong> : la période est passée et la vague n’est pas clôturée.</li>
        <li><strong>Clôturée</strong> : le bilan est figé.</li>
      </ul>

      <h2>3. Suivre l’avancement</h2>
      <p>Chaque vague affiche, en direct, d’après les leads de sa région :</p>
      <ul>
        <li>
          <strong>Visités</strong> : leads dont la visite est enregistrée pendant la période (« Déjà visité » sur la
          fiche, ou une note de type « visite » dans le fil).
        </li>
        <li>
          <strong>Convertis</strong> : leads passés dans une étape « gagné » pendant la période (voir{" "}
          <Link href="/docs/pipeline">Pipeline et étapes</Link>).
        </li>
        <li>
          <strong>À repasser</strong> : leads encore ouverts (ni gagnés ni perdus) et non visités pendant la période. Le
          bouton « Voir les leads à repasser » en donne la liste.
        </li>
      </ul>
      <p>Une barre montre les visites par rapport à l’objectif.</p>

      <h2>4. Clôturer avec un bilan</h2>
      <p>
        Quand la vague est finie, <strong>Clôturer la vague</strong> fige le bilan (visités, convertis, à repasser) tel
        qu’il est ce jour-là. Un lead visité ensuite ne le change plus : vous pouvez comparer vos vagues entre elles. Une
        vague clôturée ne se modifie plus. Les leads à repasser se retrouvent dans la prochaine vague de la même région.
      </p>

      <h2>La carte</h2>
      <p>
        <strong>Vagues › Carte</strong> montre un globe et la carte OpenStreetMap. Chaque région y est dessinée avec la
        couleur de sa vague (en cours, en retard, à venir, clôturée), et chaque lead prend la couleur de sa région. Faites
        tourner le globe et cliquez sur un endroit : la carte s’y rend.
      </p>

      <Callout title="Qui peut faire quoi ?">
        Tout membre voit les régions et les vagues. Créer, modifier, clôturer et supprimer demande le droit « wave »
        (CEO et Manager par défaut, ajustable dans les rôles). Une région qui a eu des vagues ne peut pas être supprimée :
        elle garde leur historique.
      </Callout>
    </DocArticle>
  );
}

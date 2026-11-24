import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/accounts");

export default function Page() {
  return (
    <DocArticle href="/docs/accounts">
      <p>
        Un <strong>compte</strong> est une entreprise cliente. Chaque affaire que vous suivez avec elle est une{" "}
        <strong>opportunité</strong>, c’est-à-dire un <Link href="/docs/lead">lead</Link> rattaché au compte. Une
        boulangerie peut ainsi avoir une opportunité « site vitrine » gagnée et une opportunité « logiciel de caisse » en
        cours.
      </p>

      <h2>Créer un compte</h2>
      <ul>
        <li>
          Depuis <strong>CRM › Comptes</strong>, <strong>Nouveau compte</strong> ; ou
        </li>
        <li>
          depuis la fiche d’un lead, section « Compte » : <strong>Créer un compte à partir de ce lead</strong> reprend son
          nom, son secteur et son site, et le rattache au compte.
        </li>
      </ul>

      <h2>Ajouter des opportunités</h2>
      <p>
        Sur la fiche d’un compte, <strong>Nouvelle opportunité</strong> crée un lead déjà rattaché (nom, service, valeur
        estimée). Pour rattacher un lead existant, choisissez le compte dans la section « Compte » de sa fiche. Un lead peut
        aussi rester sans compte.
      </p>

      <h2>Ce que montre un compte</h2>
      <p>
        Le nombre d’opportunités, la <strong>valeur en cours</strong> (étapes ouvertes) et la <strong>valeur
        gagnée</strong> (étapes « gagné »). Les leads perdus ne comptent pas. Supprimer un compte ne supprime pas ses
        opportunités : elles redeviennent des leads sans compte.
      </p>

      <Callout title="Qui voit quoi ?">
        Tout membre voit la liste des comptes, mais seulement les opportunités qu’il a le droit de lire : les chiffres d’un
        compte sont ceux de ces opportunités. Créer, modifier et supprimer un compte demande le droit « account » (CEO et
        Manager par défaut).
      </Callout>
    </DocArticle>
  );
}

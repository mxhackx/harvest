import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/quotes");

export default function Page() {
  return (
    <DocArticle href="/docs/quotes">
      <h2>Préparer un devis</h2>
      <p>
        Sur la fiche d’un <Link href="/docs/lead">lead</Link> (une opportunité), l’onglet <strong>Devis</strong> liste ses
        devis. <strong>Nouveau devis</strong> ouvre un brouillon : un titre, des lignes (désignation, quantité, prix
        unitaire), un taux de taxe, une date de validité et des notes. Les totaux se calculent pendant la saisie. Chaque devis
        a un numéro unique par entreprise, du type <code>D-2026-0001</code>.
      </p>

      <h2>Le faire avancer</h2>
      <ol>
        <li><strong>Brouillon</strong> : modifiable et supprimable.</li>
        <li><strong>Envoyé</strong> (« Marquer comme envoyé ») : il est figé, il ne se modifie plus. Il faut au moins une ligne.</li>
        <li><strong>Accepté</strong> ou <strong>Refusé</strong> (« Le client accepte / refuse ») : décision finale.</li>
      </ol>
      <p>
        Chaque étape ajoute une note dans le fil du lead. Quand un devis est <strong>accepté</strong>, la valeur estimée du
        lead prend le montant total du devis. Un devis envoyé ne se supprime pas : il garde la trace de ce qui a été proposé.
      </p>

      <h2>Imprimer ou enregistrer en PDF</h2>
      <p>
        <strong>Imprimer / PDF</strong> ouvre l’impression du navigateur avec une page propre (sans menu). Choisissez
        « Enregistrer au format PDF » pour l’envoyer à votre client. {" "}
        <Link href="/docs/messages">L’envoi par e-mail</Link> reste manuel : joignez le PDF à votre message.
      </p>

      <Callout title="Qui voit quoi ?">
        Un devis suit les droits sur son lead : on le lit avec le droit de lire le lead, on l’écrit avec celui de le modifier.
        Quelqu’un qui ne voit pas le lead n’en voit pas les devis.
      </Callout>
    </DocArticle>
  );
}

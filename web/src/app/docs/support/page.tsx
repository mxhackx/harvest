import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/support");

export default function Page() {
  return (
    <DocArticle href="/docs/support">
      <h2>Tickets</h2>
      <p>
        <strong>Service › Tickets</strong> suit les demandes et réclamations de vos clients après la vente. <strong>Nouveau
        ticket</strong> : un objet, une description, le client concerné (un lead, facultatif) et une priorité (basse, normale,
        haute, urgente). Sur la page d’un ticket, changez son <strong>statut</strong> (ouvert, en cours, résolu, fermé), sa
        priorité, confiez-le à un collègue (il reçoit une notification) et échangez dans le fil de <strong>commentaires</strong>.
        La liste se filtre par état (« À traiter » regroupe ouverts et en cours) et sur « les miens ».
      </p>

      <h2>Base de connaissances</h2>
      <p>
        <strong>Service › Base de connaissances</strong> rassemble les réponses fréquentes de l’équipe : un titre, un contenu et des
        mots-clés. La recherche porte sur le titre, le contenu et les mots-clés. Tout le monde peut lire ; créer, modifier et
        supprimer des articles demande le droit « kb » (CEO et Manager par défaut).
      </p>

      <Callout title="Qui voit quoi ?">
        Les tickets sont ceux de toute l’entreprise : tous les rôles qui ont le droit « ticket » les voient et les mettent à jour
        (CEO, Manager et Prospecteur par défaut). Seuls le CEO et le Manager peuvent en supprimer.
      </Callout>
    </DocArticle>
  );
}

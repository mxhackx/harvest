import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/equipe");

export default function Page() {
  return (
    <DocArticle href="/docs/equipe">
      <h2>Inviter un collaborateur</h2>
      <ol>
        <li>Ouvrez <strong>Équipe › Membres</strong>.</li>
        <li>Dans « Inviter quelqu’un », saisissez son e-mail, choisissez un rôle et une équipe.</li>
        <li>Cliquez sur <strong>Créer le lien</strong>, copiez-le et transmettez-le (message, WhatsApp…).</li>
      </ol>
      <p>
        Harvest n’envoie pas d’e-mail : le lien est affiché <strong>une seule fois</strong>. Il ne fonctionne que pour
        l’adresse indiquée et expire au bout de 7 jours. Refaire une invitation pour la même adresse remplace l’ancien
        lien ; vous pouvez aussi annuler une invitation en attente.
      </p>
      <p>
        La personne ouvre le lien, se connecte ou crée un compte avec <em>cette adresse</em>, puis clique sur « Rejoindre ».
      </p>

      <h2>Rôles</h2>
      <p>
        Les rôles se cumulent : si une personne en a plusieurs, c’est la portée la plus large de chaque droit qui
        l’emporte. Vous ne pouvez pas accorder (ni retirer) des droits que vous n’avez pas vous-même : un Manager ne peut
        pas nommer un CEO. Il reste toujours au moins un CEO.
      </p>

      <h2>Équipes</h2>
      <p>
        Une équipe regroupe des membres. Avec la portée « équipe », un droit s’applique aux leads, tâches et rendez-vous
        de toute l’équipe. Changer un membre d’équipe déplace aussi ses leads, tâches et rendez-vous. Supprimer une
        équipe laisse ses membres sans équipe.
      </p>

      <h2>Réattribuer des leads</h2>
      <p>
        Avec le droit d’attribuer, sélectionnez des leads dans le tableau puis « Attribuer à… », ou utilisez le bouton de
        la <Link href="/docs/fiche-lead">fiche lead</Link>. Le lead passe à la personne choisie et à son équipe, l’action
        apparaît dans le fil d’activité et la personne est notifiée.
      </p>
      <Callout title="Quand quelqu’un part">
        Retirer un membre ne supprime pas ses leads : ils restent à son nom. Réattribuez-les avant ou juste après pour
        que l’équipe continue à les voir.
      </Callout>

      <h2>Plusieurs entreprises</h2>
      <p>
        Un même compte peut appartenir à plusieurs entreprises (par exemple après une invitation). Le menu de votre
        photo, en haut à droite, propose alors « Changer d’entreprise ». Les données et les droits changent avec elle.
      </p>
    </DocArticle>
  );
}

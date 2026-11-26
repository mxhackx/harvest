import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/team");

export default function Page() {
  return (
    <DocArticle href="/docs/team">
      <h2>L’entreprise</h2>
      <p>
        La création se fait en quatre écrans : nom et photo (facultative), e-mail et téléphone (avec l’indicatif du pays),
        secteur, puis région et première équipe. Ensuite, la vignette en bas à gauche (sur téléphone : <strong>Entreprise</strong>
        dans la barre du bas) ouvre ces réglages. Seul le CEO peut les modifier.
      </p>

      <h2>Inviter un collaborateur</h2>
      <ol>
        <li>Ouvrez <strong>ERP › Équipe</strong>.</li>
        <li>Dans « Inviter quelqu’un », saisissez son e-mail, choisissez un rôle et une équipe.</li>
        <li>Cliquez sur <strong>Créer le lien</strong> : l’e-mail part, et vous pouvez aussi copier le lien pour l’envoyer vous-même (message, WhatsApp…).</li>
      </ol>
      <p>
        Un e-mail avec le lien part vers la personne (voir plus bas), et le lien est aussi affiché{" "}
        <strong>une seule fois</strong> pour que vous puissiez le copier. Il ne fonctionne que pour l’adresse indiquée et expire au bout de 7 jours. Refaire une invitation pour la même adresse remplace l’ancien
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

      <h2>L’e-mail d’invitation</h2>
      <p>
        Quand vous invitez quelqu’un, {BRAND.name} lui envoie un e-mail avec le lien (valable 7 jours, personnel). Si l’envoi
        échoue, ou si l’e-mail n’est pas configuré, la page vous l’indique et affiche le lien à transmettre vous-même.
        Une personne qui a oublié son mot de passe le réinitialise depuis « Mot de passe oublié ? » sur la page de
        connexion : le lien reçu vaut une heure et ne sert qu’une fois, et il la déconnecte de tous ses appareils.
      </p>

      <h2>Attribuer dès la création</h2>
      <p>
        Dans le formulaire « Nouveau lead », le bloc <strong>Responsable</strong> propose « Attribuer à » : choisissez la
        personne qui suivra ce lead, elle est prévenue tout de suite. Sans choix, le lead vous revient. Le menu n’apparaît
        que si vous avez le droit d’attribuer ; sinon le lead est toujours à votre nom. On ne peut attribuer qu’à une
        personne que ses droits vous autorisent à servir : sinon la création est refusée et rien n’est créé.
      </p>

      <h2>Réattribuer des leads</h2>
      <p>
        Avec le droit d’attribuer, sélectionnez des leads dans le tableau puis « Attribuer à… », ou utilisez le bouton de
        la <Link href="/docs/lead">fiche lead</Link>. Le lead passe à la personne choisie et à son équipe, l’action
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

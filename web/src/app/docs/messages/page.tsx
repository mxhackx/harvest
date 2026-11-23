import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/messages");

export default function Page() {
  return (
    <DocArticle href="/docs/messages">
      <h2>La page Contacts</h2>
      <p>
        <strong>CRM › Contacts</strong> réunit les personnes de tous vos leads. Cherchez par nom, fonction, téléphone,
        e-mail ou nom de lead ; cliquez sur le lead pour ouvrir sa <Link href="/docs/fiche-lead">fiche</Link>. On ajoute
        et on modifie les contacts depuis la fiche. Vous ne voyez que les contacts des leads que vous avez le droit de lire.
      </p>

      <h2>Modèles de messages</h2>
      <p>
        <strong>CRM › Modèles de messages</strong> contient des textes prêts à envoyer, par canal (WhatsApp ou e-mail),
        partagés dans toute l’entreprise. Tout le monde les utilise ; créer, modifier ou supprimer demande le droit
        correspondant (par défaut : CEO et Manager).
      </p>
      <p>Trois variables sont remplacées à l’envoi :</p>
      <ul>
        <li><code>{"{{contact}}"}</code> : le nom du destinataire.</li>
        <li><code>{"{{entreprise}}"}</code> : le nom du lead.</li>
        <li><code>{"{{moi}}"}</code> : votre nom.</li>
      </ul>

      <h2>Envoyer un message</h2>
      <ol>
        <li>Sur une fiche lead, cliquez sur <strong>Envoyer un message</strong> (ou sur <strong>Message</strong> dans la page Contacts).</li>
        <li>Choisissez le modèle et le destinataire : un contact, ou le numéro de l’entreprise.</li>
        <li>Relisez et retouchez le texte, puis cliquez sur <strong>Ouvrir WhatsApp</strong> (ou l’e-mail).</li>
      </ol>
      <p>
        Harvest ouvre WhatsApp ou votre messagerie avec le texte prérempli : <strong>c’est vous qui appuyez sur
        envoyer</strong>. Harvest ne peut pas savoir si le message est parti ; il inscrit l’envoi dans le{" "}
        fil d’activité du lead, ce qui garde la trace de ce que vous avez préparé.
      </p>
      <Callout title="Numéro manquant">
        Si le destinataire n’a pas de numéro (ou d’adresse e-mail pour un modèle e-mail), le bouton reste grisé et un
        message l’explique. Complétez le contact depuis la fiche.
      </Callout>

      <h2>Segments : vos vues enregistrées</h2>
      <p>
        Dans <strong>CRM › Leads</strong>, réglez la recherche, les filtres, l’onglet et le tri, puis{" "}
        <strong>Segments › Enregistrer la vue actuelle</strong> et donnez un nom (« À visiter à Cotonou »). Un clic sur
        le segment rétablit tout. Les segments sont personnels : personne d’autre ne les voit. Trente au plus.
      </p>

      <h2>Épingler une page</h2>
      <p>
        Dans le menu de gauche, survolez une page et cliquez sur l’épingle : elle apparaît alors en haut, sous
        « Épinglées », quel que soit le module où vous êtes. Le choix est retenu sur cet appareil.
      </p>
    </DocArticle>
  );
}

import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/lead");

export default function Page() {
  return (
    <DocArticle href="/docs/lead">
      <h2>Ouvrir la fiche</h2>
      <p>
        Cliquez sur le nom d’un lead dans le tableau, le board ou la carte (« Ouvrir la fiche »). Le crayon, lui, ouvre
        la modification rapide.
      </p>

      <h2>Changer l’étape</h2>
      <p>
        La rangée d’étapes en haut de la fiche permet de faire avancer le lead en un clic. Pour une étape « perdue »,
        {BRAND.name} demande le motif. Chaque changement est inscrit dans le fil d’activité.
      </p>

      <h2>L’opportunité</h2>
      <p>Dans « Modifier le lead », la partie <strong>Suivi</strong> décrit l’opportunité :</p>
      <ul>
        <li><strong>Valeur estimée</strong> : le montant espéré.</li>
        <li><strong>Service demandé</strong> : ce que le prospect veut (texte libre).</li>
        <li>
          <strong>Probabilité de conversion</strong> : de 0 à 100 %. Laissée vide, c’est la probabilité de l’étape qui
          s’applique. Elle sert à la valeur pondérée (valeur × probabilité) des{" "}
          <Link href="/docs/reports">rapports</Link>.
        </li>
        <li><strong>Conclusion espérée</strong> : la date où vous comptez signer. Elle s’affiche en rouge une fois dépassée, tant que le lead est ouvert.</li>
        <li><strong>Responsable</strong> : choisi à la création (voir <Link href="/docs/team">Équipe</Link>), modifiable avec « Attribuer à… ».</li>
        <li>
          <strong>Prochain suivi</strong> : calculé tout seul, c’est l’échéance la plus proche des tâches ouvertes du
          lead. Sans tâche à venir, la fiche affiche « Aucun suivi prévu » en rouge : un lead sans suivi risque d’être
          oublié.
        </li>
      </ul>

      <h2>Le fil d’activité</h2>
      <p>
        Le fil raconte l’histoire du lead, du plus récent au plus ancien. Il mélange deux sortes d’entrées :
      </p>
      <ul>
        <li><strong>Vos saisies</strong> : note, appel, message, visite, e-mail. Vous pouvez modifier ou supprimer les vôtres.</li>
        <li><strong>Les événements du système</strong> : création ou import, changement d’étape, visite, attribution. Ils ne peuvent pas être modifiés, pour que l’historique reste fiable.</li>
      </ul>
      <p>
        Les noms d’étape du fil sont ceux de l’époque : renommer une étape plus tard ne réécrit pas l’histoire.
      </p>

      <h2>Mentionner un collègue</h2>
      <p>
        Dans une note du fil, tapez <strong>@</strong> puis les premières lettres d’un prénom ou d’un nom : choisissez le
        collègue proposé. Il reçoit une <strong>notification</strong> (la cloche) qui mène au lead. On ne peut mentionner
        que quelqu’un qui a le droit de lire ce lead : un collègue qui ne le voit pas n’est pas proposé.
      </p>

      <h2>Plusieurs contacts par entreprise</h2>
      <p>
        L’onglet <strong>Contacts</strong> liste les personnes à joindre : nom, fonction, téléphone, WhatsApp, e-mail,
        notes. Un contact est <strong>principal</strong> ; son nom est celui qui apparaît dans le champ « Contact » du
        lead et dans les exports. Supprimer le principal désigne automatiquement le plus ancien des autres. Trente
        contacts au plus par lead.
      </p>

      <h2>Tâches et attribution</h2>
      <p>
        L’onglet <strong>Tâches</strong> montre ce qu’il reste à faire pour ce lead (voir{" "}
        <Link href="/docs/tasks">Tâches et rappels</Link>). Avec le droit d’attribuer, le bouton « Attribuer à… »
        confie le lead à un collègue, qui reçoit une notification.
      </p>

      <h2>Supprimer et restaurer</h2>
      <p>
        Supprimer un lead (depuis sa fiche ou une sélection) le met à la <strong>corbeille</strong> : il disparaît des
        listes, de la carte, des rapports et des tâches, mais ses contacts, son historique et ses tâches sont conservés.
        La page <strong>Corbeille</strong> (CRM) permet de le <strong>restaurer</strong> pendant 30 jours, ou de l’effacer
        tout de suite. Passé ce délai, il est effacé définitivement. La corbeille est réservée à ceux qui ont le droit de
        supprimer des leads.
      </p>

      <h2>Doublons et fusion</h2>
      <p>
        <strong>CRM › Doublons</strong> liste les leads qui semblent être la même entreprise : même numéro de téléphone
        (au moins 7 chiffres), ou même nom dans la même ville (« Salon (2) » compte comme « Salon »). Choisissez le lead à
        garder et cliquez sur <strong>Fusionner</strong> : contacts, historique, tâches, rendez-vous et e-mails passent au
        lead gardé, ses champs vides sont complétés par ceux du doublon, et une note « Fusion » est ajoutée au fil. La
        fusion est irréversible ; elle demande le droit de modifier et de supprimer les leads concernés.
      </p>

      <h2>Données personnelles (RGPD)</h2>
      <p>
        Chaque contact de l’onglet <strong>Contacts</strong> a deux actions pour répondre à une demande d’une personne :
        <strong> Exporter ses données</strong> télécharge un fichier JSON avec tout ce qui est gardé sur elle, et{" "}
        <strong>Effacer</strong> la supprime définitivement (après confirmation) et retire son nom du lead. L’export
        demande le droit d’exporter, l’effacement celui de supprimer des leads. Le journal d’audit garde la trace de
        l’action, sans le nom de la personne. Les notes libres du fil ne sont pas analysées : relisez-les si elles
        citent la personne.
      </p>

      <Callout title="Qui voit quoi ?">
        Le fil, les contacts et les tâches d’un lead suivent les droits sur ce lead. Si vous ne pouvez pas lire un lead,
        sa fiche vous répond « introuvable » : on ne révèle pas son existence.
      </Callout>
    </DocArticle>
  );
}

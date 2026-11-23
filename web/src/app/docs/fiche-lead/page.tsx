import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/fiche-lead");

export default function Page() {
  return (
    <DocArticle href="/docs/fiche-lead">
      <h2>Ouvrir la fiche</h2>
      <p>
        Cliquez sur le nom d’un lead dans le tableau, le board ou la carte (« Ouvrir la fiche »). Le crayon, lui, ouvre
        la modification rapide.
      </p>

      <h2>Changer l’étape</h2>
      <p>
        La rangée d’étapes en haut de la fiche permet de faire avancer le lead en un clic. Pour une étape « perdue »,
        Harvest demande le motif. Chaque changement est inscrit dans le fil d’activité.
      </p>

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
        <Link href="/docs/taches">Tâches et rappels</Link>). Avec le droit d’attribuer, le bouton « Attribuer à… »
        confie le lead à un collègue, qui reçoit une notification.
      </p>

      <Callout title="Qui voit quoi ?">
        Le fil, les contacts et les tâches d’un lead suivent les droits sur ce lead. Si vous ne pouvez pas lire un lead,
        sa fiche vous répond « introuvable » : on ne révèle pas son existence.
      </Callout>
    </DocArticle>
  );
}

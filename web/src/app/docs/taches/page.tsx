import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/taches");

export default function Page() {
  return (
    <DocArticle href="/docs/taches">
      <h2>Créer une tâche</h2>
      <p>
        Ouvrez <strong>CRM › Tâches</strong>, ou l’onglet <strong>Tâches</strong> d’une{" "}
        <Link href="/docs/fiche-lead">fiche lead</Link>, puis cliquez sur <strong>Nouvelle tâche</strong>. Indiquez ce
        qu’il y a à faire, une échéance (facultative) et le lead concerné.
      </p>

      <h2>Priorité</h2>
      <p>
        Chaque tâche est de priorité <strong>normale</strong> par défaut ; choisissez <strong>haute</strong> ou{" "}
        <strong>basse</strong> à la création ou en la modifiant. À échéance égale, les tâches de priorité haute passent
        devant, et la mention « Priorité haute » reste visible tant qu’elles ne sont pas terminées.
      </p>

      <h2>Classées par urgence</h2>
      <ul>
        <li><strong>En retard</strong> : l’échéance est passée.</li>
        <li><strong>Aujourd’hui</strong> et <strong>À venir</strong>.</li>
        <li><strong>Sans échéance</strong> : en dernier.</li>
      </ul>
      <p>Cochez une tâche pour la terminer : elle passe dans l’onglet « Terminées » et peut être rouverte.</p>

      <h2>Confier une tâche</h2>
      <p>
        Avec le droit d’attribuer des tâches, un menu « Attribuée à » apparaît. La personne reçoit une notification.
        Vous ne pouvez confier une tâche qu’à quelqu’un dans la portée de votre droit : votre équipe, ou toute
        l’entreprise selon votre rôle. Sans ce droit, vos tâches sont pour vous.
      </p>

      <h2>La cloche</h2>
      <p>
        La cloche, en haut à droite, affiche le nombre de tâches en retard et les notifications non lues (tâche ou lead
        qu’on vous a confié). Cliquer sur une notification l’ouvre et la marque comme lue. Les retards sont recalculés à
        chaque ouverture : aucun rappel n’est envoyé par e-mail.
      </p>

      <Callout title="Qui voit quelles tâches ?">
        Comme pour les leads : un Prospecteur ne voit que les siennes, un Manager celles de l’entreprise. Le nom du lead
        lié n’apparaît que si vous avez le droit de lire ce lead.
      </Callout>
    </DocArticle>
  );
}

import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/automations");

export default function Page() {
  return (
    <DocArticle href="/docs/automations">
      <p>
        <strong>ERP › Automatisations</strong> (CEO et Manager) regroupe des règles qui travaillent à votre place. Chaque règle
        peut être mise en pause ou supprimée, et indique combien de leads elle a déjà traités. Un lead n’est traité qu’une
        fois par règle.
      </p>

      <h2>Attribuer les nouveaux leads</h2>
      <p>
        Choisissez des personnes : chaque nouveau lead (créé à la main, sans responsable précisé) est confié à la suivante, à
        tour de rôle. Le lead appartient alors à cette personne et à son équipe, et elle reçoit une notification.
      </p>

      <h2>Relancer par une tâche</h2>
      <p>
        X jours après la création d’un lead encore ouvert, si <strong>rien ne s’est passé</strong> (ni visite, ni appel, ni
        message, ni e-mail dans son fil) et qu’il n’a pas déjà une tâche ouverte, une tâche de relance est créée pour son responsable.
        Le titre peut contenir <code>{"{{entreprise}}"}</code> et <code>{"{{contact}}"}</code>.
      </p>

      <h2>Relancer par e-mail</h2>
      <p>
        Même condition, mais l’action est un e-mail de suivi envoyé au <strong>contact principal</strong> du lead (s’il a une
        adresse), avec l’adresse du responsable en « répondre à ». L’envoi est inscrit dans le fil du lead.
      </p>

      <Callout title="À savoir">
        Les règles se vérifient toutes les 15 minutes. Une règle ne réveille pas les leads créés il y a plus de 30 jours
        après son échéance. Pour l’e-mail, n’activez la règle que si vos contacts ont accepté d’être relancés.
      </Callout>
    </DocArticle>
  );
}

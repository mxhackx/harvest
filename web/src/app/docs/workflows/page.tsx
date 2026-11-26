import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/workflows");

export default function Page() {
  return (
    <DocArticle href="/docs/workflows">
      <p>
        <strong>IA › Workflows</strong> permet de dessiner une chaîne : un déclencheur (<strong>Start</strong>), puis des étapes
        qui se suivent. La liste de vos workflows est à gauche, le dessin au centre, les réglages à droite.
      </p>

      <Callout title="Pas encore d’exécution">
        L’éditeur enregistre et vérifie vos chaînes. Le moteur qui les fera tourner n’est pas encore disponible : aucun
        message n’est envoyé et aucune tâche n’est créée.
      </Callout>

      <h2>Construire une chaîne</h2>
      <p>
        Dans l’onglet <strong>Blocs</strong>, cliquez sur un bloc pour l’ajouter au bout de la chaîne, ou glissez-le sur le
        dessin pour le placer librement puis reliez-le en tirant d’un point à l’autre. La chaîne reste droite : un seul bloc
        avant et un seul après, sans boucle.
      </p>
      <ul>
        <li><strong>Agent</strong> : une action confiée à l’IA, avec une consigne et un niveau d’autonomie.</li>
        <li><strong>Tâche</strong> et <strong>E-mail</strong> : créer une tâche, écrire au contact principal.</li>
        <li><strong>Condition</strong> : la chaîne s’arrête si le test est faux.</li>
        <li><strong>Validation</strong> : attendre l’accord d’une personne.</li>
      </ul>

      <h2>Régler les blocs</h2>
      <p>
        Un clic sur un bloc ouvre l’onglet <strong>Éditeur</strong>. Sur Start, choisissez le déclencheur et décrivez les
        entrées attendues (nom, type, description, valeur par défaut). La petite barre au-dessus d’un bloc permet de le
        désactiver, le verrouiller, le dupliquer ou le supprimer (la chaîne se recoud toute seule). La touche Suppr retire le
        lien sélectionné.
      </p>

      <h2>Autonomie des agents</h2>
      <p>
        Quatre niveaux : suggérer, agir avec validation, agir seul sous seuil, agir seul. Les actions sensibles (envoyer un
        message, fusionner des doublons) ne dépassent jamais le niveau 2 : une personne valide toujours.
      </p>

      <h2>Vérifier et enregistrer</h2>
      <p>
        <strong>Vérifier</strong> remplit le journal bloc par bloc (champs manquants, blocs non reliés) ; un clic sur une ligne
        ouvre le bloc. Rien n’est enregistré tant que vous ne cliquez pas sur <strong>Enregistrer</strong>. Un brouillon
        incomplet peut être enregistré.
      </p>
    </DocArticle>
  );
}

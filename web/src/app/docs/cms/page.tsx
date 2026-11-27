import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/cms");

export default function Page() {
  return (
    <DocArticle href="/docs/cms">
      <p>
        Le CMS (<strong>cms.hivation.tech</strong>) est un produit à part du CRM. Créez un compte directement sur son écran de
        connexion, ou, si vous avez déjà un compte Hivation, choisissez <strong>Continuer avec Hivation</strong>. Aucune
        entreprise n’est demandée : vos sites sont à vous seul.
      </p>
      <Callout title="Enregistrement">
        Chaque modification est enregistrée toute seule sur votre compte ; l’état s’affiche en haut de l’éditeur. Si le site a
        été modifié dans un autre onglet, rien n’est écrasé : rechargez la page. L’IA et la publication en un clic ne sont pas
        encore disponibles.
      </Callout>

      <h2>Pages, cadres et éléments</h2>
      <ul>
        <li>Un site contient des <strong>pages</strong>, chacune avec son adresse.</li>
        <li>Un <strong>cadre</strong> range d’autres éléments, en colonne, en rangée ou en grille.</li>
        <li>Éléments : texte, bouton, image, formulaire. Les <strong>blocs prêts</strong> sont des cadres déjà remplis.</li>
      </ul>

      <h2>Modifier</h2>
      <ul>
        <li><strong>Double-cliquez</strong> un texte ou un bouton pour écrire sur le canevas ; Entrée valide.</li>
        <li><strong>Glissez</strong> un élément sur le canevas ou dans les calques, ou depuis « Ajouter ».</li>
        <li><strong>Design</strong> : disposition, tailles, marges, typographie, couleurs, contour, ombre.</li>
        <li><strong>Styles</strong> : variables de couleur et styles de texte, partagés par toutes les pages.</li>
        <li>Ctrl + Z annule, Ctrl + molette zoome.</li>
      </ul>

      <h2>Composants</h2>
      <p>
        L’onglet <strong>Composants</strong> propose des éléments prêts (boutons WhatsApp, cartes, horaires, menu, pied de
        page…). Cliquez ou glissez : une <strong>copie</strong> est posée dans la page, aux couleurs du site, et vous modifiez
        tout librement. Pour les voir en grand avec leur aspect, utilisez le bouton <strong>Composants</strong> en haut de l’éditeur (aux couleurs du
        site ouvert) ou la section <strong>Composants</strong> à l’accueil du CMS. La marketplace (ui.hivation.tech) permet
        aussi de les parcourir sans se connecter.
      </p>

      <h2>Exporter le code</h2>
      <p>
        Le bouton télécharge un projet Next.js complet : les pages, une API pour le formulaire de contact et le schéma de la
        base PostgreSQL. Le fichier README du projet explique comment le lancer. Avant de le mettre en ligne, ajoutez une
        limite de débit à l’API et les mentions légales.
      </p>

      <h2>Contrôles</h2>
      <p>Logo présent, aucun texte de remplacement, aucun lien vide, texte alternatif sur chaque image.</p>
    </DocArticle>
  );
}

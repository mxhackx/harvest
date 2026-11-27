import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/cms");

export default function Page() {
  return (
    <DocArticle href="/docs/cms">
      <p>
        <strong>Sites</strong> (réservé au CEO) ouvre le CMS, une application à part. Choisissez un modèle de départ, puis
        <strong> Nouveau site</strong>.
      </p>
      <Callout title="À savoir">
        Les sites sont enregistrés dans ce navigateur seulement. L’IA et la publication depuis le CMS ne sont pas encore
        disponibles : vous exportez le code pour l’héberger.
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

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
      <Callout title="Première version">
        Les sites sont enregistrés dans ce navigateur seulement. La publication, le partage et l’IA ne sont pas encore disponibles.
      </Callout>
      <h2>L’éditeur</h2>
      <ul>
        <li><strong>À gauche</strong> : les calques (monter, descendre, masquer, dupliquer, supprimer) et l’ajout de blocs.</li>
        <li><strong>Au centre</strong> : le canevas, en mobile, tablette ou bureau. Ctrl + molette zoome.</li>
        <li><strong>À droite</strong> : le contenu du bloc choisi, le thème du site et les contrôles.</li>
      </ul>
      <p><strong>Aperçu</strong> montre le site sans les repères ; Échap le ferme. Ctrl + Z annule.</p>
      <h2>Contrôles</h2>
      <p>
        Logo présent, téléphone avec indicatif, horaires et adresse, aucun texte de remplacement, texte alternatif sur chaque
        image. Un clic sur un échec ouvre le bloc à corriger.
      </p>
    </DocArticle>
  );
}

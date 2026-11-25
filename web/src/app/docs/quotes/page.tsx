import Link from "next/link";
import { Callout, CodeBlock, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/quotes");

export default function Page() {
  return (
    <DocArticle href="/docs/quotes">
      <h2>Préparer un devis</h2>
      <p>
        Sur la fiche d’un <Link href="/docs/lead">lead</Link> (une opportunité), l’onglet <strong>Devis</strong> liste ses
        devis. <strong>Nouveau devis</strong> ouvre un brouillon : un titre, des lignes (désignation, quantité, prix
        unitaire), un taux de taxe, une date de validité et des notes. Les totaux se calculent pendant la saisie. Chaque devis
        a un numéro unique par entreprise, du type <code>D-2026-0001</code>.
      </p>

      <h2>Le faire avancer</h2>
      <ol>
        <li><strong>Brouillon</strong> : modifiable et supprimable.</li>
        <li><strong>Envoyé</strong> (« Marquer comme envoyé ») : il est figé, il ne se modifie plus. Il faut au moins une ligne.</li>
        <li><strong>Accepté</strong> ou <strong>Refusé</strong> (« Le client accepte / refuse ») : décision finale.</li>
      </ol>
      <p>
        Chaque étape ajoute une note dans le fil du lead. Quand un devis est <strong>accepté</strong>, la valeur estimée du
        lead prend le montant total du devis. Un devis envoyé ne se supprime pas : il garde la trace de ce qui a été proposé.
      </p>

      <h2>Imprimer ou enregistrer en PDF</h2>
      <p>
        <strong>Imprimer / PDF</strong> ouvre l’impression du navigateur avec une page propre (sans menu). Choisissez
        « Enregistrer au format PDF » pour l’envoyer à votre client. {" "}
        <Link href="/docs/messages">L’envoi par e-mail</Link> reste manuel : joignez le PDF à votre message.
      </p>

      <h2>Importer et exporter des devis (JSON, CSV)</h2>
      <p>
        Sur l’onglet <strong>Devis</strong> d’un lead, <strong>Exporter (CSV)</strong> et <strong>Exporter (JSON)</strong>{" "}
        téléchargent ses devis ; <strong>Importer</strong> crée des <strong>brouillons</strong> à partir d’un fichier (on
        analyse d’abord, puis on confirme). Les numéros sont attribués à l’import. L’export JSON peut être réimporté tel quel.
      </p>
      <p><strong>JSON</strong> : un tableau de devis (ou un seul), avec ses lignes.</p>
      <CodeBlock lang="json" label="Devis (JSON)" code={`[
  {
    "title": "Site vitrine",
    "taxRate": 18,
    "validUntil": "2026-12-31",
    "notes": "Paiement à 30 jours",
    "lines": [
      { "label": "Création du site", "quantity": 1, "unitPrice": 250000 },
      { "label": "Formation (heures)", "quantity": 2.5, "unitPrice": 15000 }
    ]
  }
]`} />
      <p>
        <strong>CSV</strong> : une ligne par ligne de devis ; les lignes de même <code>title</code> forment un devis, dont
        la taxe, la validité et les notes se lisent sur la première ligne. Colonnes : <code>title</code>, <code>label</code>,{" "}
        <code>quantity</code>, <code>unitPrice</code> (obligatoires), <code>taxRate</code>, <code>validUntil</code>,{" "}
        <code>notes</code> (facultatives). Séparateur virgule ou point-virgule. Au plus 50 devis par fichier et 50 lignes
        par devis ; la quantité a 2 décimales au plus et le prix unitaire est un entier.
      </p>
      <CodeBlock lang="csv" label="Devis (CSV)" code={`title,taxRate,validUntil,notes,label,quantity,unitPrice
Site vitrine,18,2026-12-31,Paiement à 30 jours,Création du site,1,250000
Site vitrine,,,,Formation (heures),2.5,15000`} />

      <Callout title="Qui voit quoi ?">
        Un devis suit les droits sur son lead : on le lit avec le droit de lire le lead, on l’écrit avec celui de le modifier.
        Quelqu’un qui ne voit pas le lead n’en voit pas les devis.
      </Callout>
    </DocArticle>
  );
}

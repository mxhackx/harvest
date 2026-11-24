import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/invoices");

export default function Page() {
  return (
    <DocArticle href="/docs/invoices">
      <h2>Créer une facture</h2>
      <p>
        Sur la page d’un <Link href="/docs/quotes">devis accepté</Link>, <strong>Créer la facture</strong> copie ses lignes et sa
        taxe dans un brouillon (une seule facture active par devis). Vous pouvez aussi en créer une à la main. Chaque
        facture a un numéro unique par entreprise, du type <code>F-2026-0001</code>.
      </p>

      <h2>Son parcours</h2>
      <ol>
        <li><strong>Brouillon</strong> : modifiable (lignes, taxe, date limite de paiement, notes) et supprimable.</li>
        <li><strong>Envoyée</strong> : figée. Il faut au moins une ligne.</li>
        <li><strong>Payée</strong> : terminé. <strong>Annulée</strong> est possible tant qu’elle n’est pas payée ; une facture émise ne se supprime pas, elle s’annule.</li>
      </ol>
      <p>Chaque étape ajoute une note dans le fil du lead. Une facture envoyée dont la date limite est passée est signalée « en retard ».</p>

      <h2>Suivre ce qu’il reste à encaisser</h2>
      <p>
        <strong>CRM › Factures</strong> liste les factures de vos leads, avec le total <strong>à encaisser</strong> (envoyées, pas encore
        payées) et le nombre de factures en retard. <strong>Imprimer / PDF</strong> donne une page propre à envoyer au client.
      </p>

      <Callout title="Qui voit quoi ?">
        Une facture suit les droits sur son lead, comme un devis : on la lit avec le droit de lire le lead, on l’écrit avec celui de le modifier.
      </Callout>
    </DocArticle>
  );
}

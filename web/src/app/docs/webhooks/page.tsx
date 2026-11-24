import { BRAND } from "@/lib/brand";
import { Callout, CodeBlock, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/webhooks");

export default function Page() {
  return (
    <DocArticle href="/docs/webhooks">
      <p>
        Un <strong>webhook</strong> prévient un autre outil (un tableur automatisé, Zapier, Make, votre propre serveur…)
        dès qu’un événement arrive dans {BRAND.name}. Il est réservé au CEO : <strong>ERP › Webhooks</strong>.
      </p>

      <h2>Créer un webhook</h2>
      <p>
        Indiquez l’adresse (en <code>https://</code>) et cochez les événements voulus : <code>lead.created</code>,{" "}
        <code>lead.updated</code>, <code>lead.deleted</code> (mis à la corbeille) et <code>wave.closed</code>. Le{" "}
        <strong>secret de signature</strong> n’est affiché qu’une fois : copiez-le. <strong>Tester</strong> envoie un
        événement <code>ping</code>.
      </p>

      <h2>Ce que reçoit votre serveur</h2>
      <p>Une requête POST au format JSON :</p>
      <CodeBlock lang="json" label="Corps reçu (JSON)" code={`{
  "id": "…",                    // identifiant unique de l'envoi
  "event": "lead.created",
  "createdAt": "2026-11-24T10:00:00.000Z",
  "data": { "id": "…", "name": "Boulangerie Soleil" }
}`} />
      <p>
        Les en-têtes <code>X-Hivation-Event</code> et <code>X-Hivation-Signature</code> accompagnent chaque envoi. Répondez
        avec un code 2xx dans les 5 secondes.
      </p>

      <h2>Vérifier la signature</h2>
      <p>
        La signature est <code>sha256=</code> suivi du HMAC SHA-256 du <strong>corps brut</strong> avec votre secret.
        Recalculez-la et comparez ; refusez la requête si elle diffère.
      </p>
      <CodeBlock lang="javascript" label="Vérification (Node.js)" code={`import { createHmac, timingSafeEqual } from "node:crypto";

function isValid(secret, rawBody, header) {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}`} />

      <Callout title="Sécurité et pannes">
        Les adresses internes (localhost, réseau privé) sont refusées, et les redirections ne sont pas suivies. Après 10
        échecs de suite, le webhook s’éteint : corrigez votre serveur, puis recréez-le.
      </Callout>
    </DocArticle>
  );
}

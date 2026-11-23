import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/localisation");

export default function Page() {
  return (
    <DocArticle href="/docs/localisation">
      <h2>Un point par lead</h2>
      <p>
        Chaque lead qui a une position apparaît sur la carte de l’accueil sous la forme d’un petit point, relié aux
        autres par une ligne. La couleur du point indique l’étape :
      </p>
      <ul>
        <li><strong>Rouge</strong> : à visiter</li>
        <li><strong>Bleu</strong> : intéressé</li>
        <li><strong>Vert clair</strong> : maquette envoyée</li>
        <li><strong>Vert vif</strong> : acompte payé</li>
      </ul>

      <h2>Comment la position est trouvée</h2>
      <p>Harvest utilise la première source disponible, dans cet ordre :</p>
      <ol>
        <li>
          <strong>Les coordonnées</strong> saisies ou importées (<code>lat</code> et <code>lng</code>), ou le point
          placé sur la mini-carte de la fiche. Elles ne sont jamais modifiées automatiquement.
        </li>
        <li>
          <strong>Le lien Google Maps</strong> : les coordonnées sont lues dans le lien. Les liens courts
          (maps.app.goo.gl) sont suivis jusqu’à la page Google Maps.
        </li>
        <li>
          <strong>L’adresse</strong> (avec la ville, ou à défaut la région de l’entreprise) : une recherche d’adresse
          donne une position approximative.
        </li>
      </ol>
      <p>
        Sans coordonnées, sans lien et sans adresse, le lead reste « sans position » : Harvest ne le place jamais au
        centre d’une ville au hasard. La carte indique combien de leads sont dans ce cas, et un clic sur « les placer »
        relance la recherche pour ceux qui ont une adresse ou un lien.
      </p>

      <h2>Précision</h2>
      <ul>
        <li>Une position <strong>saisie à la main</strong> ou placée sur la carte est exacte.</li>
        <li>Une position lue dans un <strong>lien Google Maps</strong> est celle du lieu partagé.</li>
        <li>Une position déduite d’une <strong>adresse</strong> est approximative, surtout quand l’adresse est incomplète. La fiche et la carte l’indiquent, et vous pouvez la corriger en déplaçant le repère sur la mini-carte.</li>
      </ul>
      <p>
        Le champ <code>locationSource</code> de l’<Link href="/docs/export">export</Link> garde l’origine de chaque
        position : <code>manual</code>, <code>google_maps</code> ou <code>address</code>.
      </p>

      <h2>Formats de liens Google Maps lus</h2>
      <ul>
        <li><code>https://www.google.com/maps/place/…/@6.3654,2.3912,17z</code></li>
        <li><code>https://www.google.com/maps/@6.3654,2.3912,15z</code></li>
        <li><code>https://maps.google.com/?q=6.3654,2.3912</code></li>
        <li>Les liens courts <code>https://maps.app.goo.gl/…</code></li>
      </ul>
      <p>Seuls les liens de cartes Google sont acceptés : tout autre domaine est refusé.</p>

      <h2>Placer un lead soi-même</h2>
      <p>
        Dans la fiche d’un lead, la section « Position précise » propose une mini-carte : cliquez à l’endroit voulu, ou
        glissez le repère. Vous pouvez aussi utiliser « Ma position » (géolocalisation de l’appareil) ou « Depuis
        l’adresse ou le lien ».
      </p>

      <Callout title="Confidentialité de la recherche d’adresse">
        Pour placer un lead à partir de son adresse, Harvest envoie cette adresse à un service de recherche
        d’adresses (Nominatim, d’OpenStreetMap). Aucun autre renseignement sur le lead n’est transmis. Cette recherche
        peut être désactivée par l’administrateur de l’installation ; il reste alors possible de coller un lien Google
        Maps ou de placer le lead sur la carte.
      </Callout>

      <h2>Import de nombreux leads</h2>
      <p>
        À l’import, la recherche d’adresse se fait en arrière-plan, un lead à la fois, car le service limite le nombre
        de recherches par seconde. Les points apparaissent sur la carte au fil de l’eau. Voir{" "}
        <Link href="/docs/import">Importer des leads</Link>.
      </p>
    </DocArticle>
  );
}

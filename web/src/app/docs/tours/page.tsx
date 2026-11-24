import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/tours");

export default function Page() {
  return (
    <DocArticle href="/docs/tours">
      <p>
        Une <strong>tournée</strong> est une journée de visites : un point de départ, des prospects à voir dans un certain
        ordre, et l’itinéraire entre eux. Elle se prépare dans <strong>Vagues › Tournées</strong>.
      </p>

      <h2>Quels prospects ?</h2>
      <p>
        Seuls les prospects <strong>à visiter en présentiel</strong> et qui ont une <strong>position</strong> sur la carte
        sont proposés (voir <Link href="/docs/lead">la fiche d’un lead</Link> et <Link href="/docs/location">Position sur la
        carte</Link>). Les prospects simples, joints à distance, n’entrent pas dans une tournée. Par défaut, la liste ne
        montre que ceux qui n’ont pas encore été visités.
      </p>

      <h2>Préparer une tournée</h2>
      <ol>
        <li>Choisissez la <strong>date</strong>, l’<strong>heure de départ</strong> et les minutes passées à chaque étape.</li>
        <li>Placez le <strong>point de départ</strong> : « Ma position », ou « Placer sur la carte » puis un clic. Cochez « Revenir au point de départ » pour finir au même endroit.</li>
        <li>Cochez les prospects (30 au plus). Les boutons ↑ ↓ changent l’ordre à la main.</li>
        <li><strong>Calculer l’itinéraire</strong> garde votre ordre ; <strong>Optimiser l’ordre</strong> cherche le parcours le plus court.</li>
      </ol>
      <p>
        La carte montre l’itinéraire en voiture, le départ (D) et les étapes numérotées. Le résumé donne la durée (route
        et visites), l’heure de fin prévue et la distance ; chaque étape affiche son heure d’arrivée.
      </p>

      <h2>Enregistrer et partir</h2>
      <ul>
        <li><strong>Enregistrer</strong> garde la tournée dans « Mes tournées » : on la rouvre, on la marque comme faite ou on la supprime. Une tournée est personnelle.</li>
        <li><strong>Ouvrir dans Google Maps</strong> lance la navigation (9 étapes intermédiaires au plus).</li>
        <li><strong>Télécharger (GPX)</strong> donne la tournée complète pour une application de navigation.</li>
      </ul>

      <Callout title="Itinéraire estimé">
        Les itinéraires routiers viennent d’un service de cartographie en ligne (OSRM). S’il ne répond pas, {" "}
        l’itinéraire est estimé en ligne droite et un message le dit : les durées et distances sont alors approximatives.
        Les coordonnées des prospects d’une tournée sont envoyées à ce service pour calculer la route.
      </Callout>
    </DocArticle>
  );
}

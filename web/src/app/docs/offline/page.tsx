import { BRAND } from "@/lib/brand";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/offline");

export default function Page() {
  return (
    <DocArticle href="/docs/offline">
      <p>
        Sur le terrain, le réseau coupe. {BRAND.name} garde une copie de ce que vous avez déjà ouvert : vous continuez à
        lire vos leads, la carte, vos vagues, vos tâches et votre calendrier, et vos gestes de terrain attendent le retour
        de la connexion.
      </p>

      <h2>Ce qui marche sans réseau</h2>
      <ul>
        <li>
          <strong>Lire</strong> les pages que vous avez ouvertes avec du réseau : leads, fiche d’un lead (fil et
          contacts), régions et vagues, tâches, calendrier. Les fonds de carte déjà affichés restent visibles.
        </li>
        <li>
          <strong>Marquer un lead visité</strong> (ou changer son étape) depuis le tableau de bord ou la carte, et{" "}
          <strong>ajouter une note</strong> à son fil.
        </li>
      </ul>
      <p>
        Une bande « Hors connexion » s’affiche en haut de page, avec le nombre d’actions en attente. Un lead marqué visité
        apparaît tout de suite comme visité à l’écran.
      </p>

      <h2>Au retour du réseau</h2>
      <p>
        Les actions en attente partent toutes seules, dans l’ordre, et la bande vous dit combien ont été synchronisées. Si
        le serveur en refuse une (par exemple parce que le lead a été supprimé entre-temps), elle est abandonnée et la bande
        l’indique.
      </p>

      <h2>Ce qui demande du réseau</h2>
      <p>
        Créer ou modifier une fiche complète, importer, envoyer un e-mail, rechercher, clôturer une vague : ces actions
        échouent hors connexion avec un message clair, pour ne pas vous laisser croire qu’elles ont réussi.
      </p>

      <Callout title="Vos données restent sur l’appareil">
        La copie gardée pour le mode hors-ligne est effacée à la déconnexion. Sur un appareil partagé, déconnectez-vous
        toujours. Pour ouvrir l’application sans réseau, ouvrez-la d’abord une fois avec du réseau.
      </Callout>
    </DocArticle>
  );
}

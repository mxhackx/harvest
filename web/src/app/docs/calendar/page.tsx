import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { Callout, DocArticle } from "@/components/docs/blocks";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs/calendar");

export default function Page() {
  return (
    <DocArticle href="/docs/calendar">
      <h2>Planifier un rendez-vous</h2>
      <p>
        Dans <strong>Calendrier</strong>, cliquez sur un jour (ou sur <strong>Nouveau rendez-vous</strong>) : un titre, un
        type (visite, appel, relance), la date et l’heure de <strong>début</strong>, une heure de <strong>fin</strong>{" "}
        facultative (le même jour), le lead concerné et des notes. Sans heure de fin, le rendez-vous compte pour une heure
        dans le calendrier exporté.
      </p>

      <h2>Le retrouver dans Google Agenda, Apple ou Outlook</h2>
      <p>
        <strong>Exporter (.ics)</strong> télécharge un fichier de calendrier avec vos rendez-vous des 7 derniers jours et
        des 90 prochains. Ouvrez-le (ou importez-le) dans Google Agenda, Apple Calendrier ou Outlook : chaque rendez-vous
        garde son titre, ses heures, le nom du lead et vos notes. L’export est un instantané : pour y remettre vos
        nouveaux rendez-vous, exportez à nouveau.
      </p>

      <Callout title="Rappels">
        Une heure avant le début, {BRAND.name} vous prévient par notification et par e-mail (voir{" "}
        <Link href="/docs/tasks">Tâches et rappels</Link>).
      </Callout>
    </DocArticle>
  );
}

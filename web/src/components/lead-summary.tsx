import Link from "next/link";
import { LOCATION_SOURCE_NOTE, formatValue, type Lead } from "@/lib/api";
import { PencilIcon } from "./icons";
import { LeadLinks } from "./lead-links";
import { StatusTag } from "./status-tag";
import { Button } from "./ui";

/** Description d'un lead et ses actions rapides : partagée par la bulle de la carte et la carte flottante. */
export function LeadSummary({
  lead,
  busy,
  onToggleVisited,
  onEdit,
}: {
  lead: Lead;
  busy?: boolean;
  onToggleVisited: () => void;
  onEdit?: () => void;
}) {
  const visited = lead.visitedAt !== null;
  const located = lead.lat !== null && lead.lng !== null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 pr-7">
        <div>
          <StatusTag status={lead.status} />
        </div>
        <p className="text-title font-semibold leading-snug">{lead.name}</p>
      </div>
      <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-2 text-small">
        <dt className="text-muted">Secteur</dt>
        <dd>{lead.sector || "—"}</dd>
        <dt className="text-muted">Contact</dt>
        <dd>{lead.contactName || "—"}</dd>
        <dt className="text-muted">Téléphone</dt>
        <dd className="font-mono">{lead.phone || "—"}</dd>
        <dt className="text-muted">Adresse</dt>
        <dd>{[lead.address, lead.city].filter(Boolean).join(", ") || "—"}</dd>
        {lead.estimatedValue !== null && (
          <>
            <dt className="text-muted">Valeur</dt>
            <dd className="font-mono">{formatValue(lead.estimatedValue)}</dd>
          </>
        )}
        <dt className="text-muted">Visite</dt>
        <dd>{lead.visitedAt ? new Date(lead.visitedAt).toLocaleDateString("fr-FR") : "Pas encore visité"}</dd>
      </dl>
      <LeadLinks lead={lead} />
      {LOCATION_SOURCE_NOTE[lead.locationSource] && <p className="text-small text-muted">{LOCATION_SOURCE_NOTE[lead.locationSource]}</p>}
      <div className="flex gap-2">
        <Button className="h-9 flex-1" loading={busy} onClick={onToggleVisited}>
          {visited ? "Remettre à visiter" : "Marquer visité"}
        </Button>
        {located && (
          <a
            href={`https://www.openstreetmap.org/directions?route=%3B${lead.lat}%2C${lead.lng}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-9 items-center justify-center rounded-control border border-frame bg-card px-3 text-small font-medium hover:bg-field"
          >
            Itinéraire
          </a>
        )}
      </div>
      <Link
        href={`/leads/${lead.id}`}
        className="flex h-9 items-center justify-center rounded-control border border-frame text-small font-medium hover:bg-field"
      >
        Ouvrir la fiche
      </Link>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="flex h-9 items-center justify-center gap-2 rounded-control border border-frame text-small font-medium hover:bg-field"
        >
          <PencilIcon size={16} /> Modifier le lead
        </button>
      )}
    </div>
  );
}

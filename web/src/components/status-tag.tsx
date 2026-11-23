import { STATUS_COLOR, STATUS_LABEL, type LeadStatus } from "@/lib/api";

const LOOK: Record<LeadStatus, string> = {
  to_visit: "bg-accent-soft text-accent-press",
  interested: "bg-forest-soft text-forest",
  mockup_sent: "bg-accent text-white",
  deposit_paid: "bg-forest text-white",
};

/** Étiquette de statut : 22 px de haut, rayon 6, 13 px gras. Une forme = un statut. */
export function StatusTag({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-md px-[9px] text-small font-bold ${LOOK[status]}`}>
      {/* même couleur que le point sur la carte : l'étiquette sert de légende */}
      <span aria-hidden className="size-2 rounded-full border border-black/15" style={{ background: STATUS_COLOR[status] }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

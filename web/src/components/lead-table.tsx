"use client";

import { formatDay, formatValue, type Lead } from "@/lib/api";
import { PencilIcon } from "./icons";
import { LeadLinks } from "./lead-links";
import { StatusTag } from "./status-tag";

type Props = {
  leads: Lead[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (lead: Lead) => void;
};

const th = "px-3 py-2 text-left text-small font-medium text-muted";

export function LeadTable({ leads, selected, onToggle, onToggleAll, onOpen }: Props) {
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const some = leads.some((l) => selected.has(l.id));

  if (leads.length === 0) return <p className="px-1 py-4 text-small text-muted">Aucun lead ne correspond.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1020px] text-body">
        <thead>
          <tr className="border-b border-rule">
            <th className="w-10 px-3 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = some && !allSelected;
                }}
                onChange={onToggleAll}
                aria-label="Tout sélectionner"
                className="size-4 accent-accent"
              />
            </th>
            <th className={th}>Nom</th>
            <th className={th}>Secteur</th>
            <th className={th}>Contact</th>
            <th className={th}>Téléphone</th>
            <th className={th}>Contacts en ligne</th>
            <th className={`${th} text-right`}>Valeur</th>
            <th className={th}>Visite</th>
            <th className={`${th} text-right`}>Étape</th>
            <th className="w-12 px-3 py-2">
              <span className="sr-only">Modifier</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const isSel = selected.has(l.id);
            return (
              <tr key={l.id} className={`border-b border-rule last:border-0 ${isSel ? "bg-accent-soft" : "hover:bg-field"}`}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => onToggle(l.id)}
                    aria-label={`Sélectionner ${l.name}`}
                    className="size-4 accent-accent"
                  />
                </td>
                <td className="px-3 py-2 font-medium">
                  <button type="button" onClick={() => onOpen(l)} className="text-left hover:underline">
                    {l.name}
                  </button>
                </td>
                <td className="px-3 py-2 text-muted">{l.sector || "—"}</td>
                <td className="px-3 py-2 text-muted">{l.contactName || "—"}</td>
                <td className="px-3 py-2 font-mono text-small text-muted">{l.phone || "—"}</td>
                <td className="px-3 py-2">
                  <LeadLinks lead={l} />
                </td>
                <td className="px-3 py-2 text-right font-mono text-small">
                  {l.estimatedValue === null ? <span className="text-muted">—</span> : formatValue(l.estimatedValue)}
                </td>
                <td className="px-3 py-2 text-small text-muted">{l.visitedAt ? `Visité le ${formatDay(l.visitedAt)}` : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <StatusTag status={l.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onOpen(l)}
                    aria-label={`Modifier ${l.name}`}
                    title="Modifier"
                    className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink"
                  >
                    <PencilIcon size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

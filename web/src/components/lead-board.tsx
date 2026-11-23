"use client";

import { useState } from "react";
import { LEAD_STATUSES, STATUS_LABEL, formatDay, formatValue, type Lead, type LeadStatus } from "@/lib/api";
import { BriefcaseIcon, CoinIcon, PencilIcon, PinIcon, UserIcon } from "./icons";
import { LeadLinks } from "./lead-links";
import { StatusTag } from "./status-tag";

type Props = {
  leads: Lead[];
  selected: Set<string>;
  canMove: boolean;
  onToggle: (id: string) => void;
  onOpen: (lead: Lead) => void;
  /** Déplace ces leads vers une étape. */
  onMove: (ids: string[], status: LeadStatus) => void;
};

const Line = ({ icon, children, mono }: { icon: React.ReactNode; children: React.ReactNode; mono?: boolean }) => (
  <p className={`flex items-center gap-2 text-small text-muted ${mono ? "font-mono" : ""}`}>
    <span className="shrink-0">{icon}</span>
    <span className="truncate">{children}</span>
  </p>
);

function Card({
  lead,
  selected,
  draggable,
  onToggle,
  onOpen,
  onDragStart,
}: {
  lead: Lead;
  selected: boolean;
  draggable: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const contact = [lead.contactName, lead.phone].filter(Boolean).join(" · ");
  const located = lead.lat !== null && lead.lng !== null;
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      className={`flex flex-col gap-2 rounded-control border p-3 ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
        selected ? "border-accent bg-accent-soft" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Sélectionner ${lead.name}`}
          className="mt-[3px] size-4 shrink-0 accent-accent"
        />
        <h3 className="text-body font-semibold leading-snug">
          <button type="button" onClick={onOpen} className="text-left hover:underline">
            {lead.name}
          </button>
        </h3>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Modifier ${lead.name}`}
          title="Modifier"
          className="-mr-1 -mt-1 ml-auto flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink"
        >
          <PencilIcon size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-1 pl-6">
        {lead.sector && <Line icon={<BriefcaseIcon size={14} />}>{lead.sector}</Line>}
        {lead.address && <Line icon={<PinIcon size={14} />}>{lead.address}</Line>}
        {contact && <Line icon={<UserIcon size={14} />}>{contact}</Line>}
        {lead.estimatedValue !== null && (
          <Line icon={<CoinIcon size={14} />} mono>
            {formatValue(lead.estimatedValue)}
          </Line>
        )}
      </div>
      <LeadLinks lead={lead} className="pl-6" />
      {(lead.visitedAt || !located) && (
        <div className="flex flex-wrap gap-1 pl-6">
          {lead.visitedAt && (
            <span className="inline-flex h-[22px] items-center rounded-md bg-forest-soft px-[9px] text-small font-bold text-forest">
              Visité le {formatDay(lead.visitedAt)}
            </span>
          )}
          {!located && (
            <span className="inline-flex h-[22px] items-center rounded-md bg-field px-[9px] text-small font-bold text-muted">
              Sans position
            </span>
          )}
        </div>
      )}
    </article>
  );
}

export function LeadBoard({ leads, selected, canMove, onToggle, onOpen, onMove }: Props) {
  const [over, setOver] = useState<LeadStatus | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {LEAD_STATUSES.map((status) => {
        const col = leads.filter((l) => l.status === status);
        const total = col.reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
        return (
          <section
            key={status}
            aria-label={STATUS_LABEL[status]}
            onDragOver={(e) => {
              if (!canMove) return;
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === status ? null : o));
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (!canMove) return;
              const ids = JSON.parse(e.dataTransfer.getData("application/x-harvest-leads") || "[]") as string[];
              if (ids.length) onMove(ids, status);
            }}
            className={`flex w-[300px] shrink-0 flex-col rounded-card border bg-field lg:min-w-[250px] lg:flex-1 ${
              over === status ? "border-accent" : "border-transparent"
            }`}
          >
            <header className="flex items-center gap-2 px-3 pb-2 pt-3">
              <StatusTag status={status} />
              <span className="font-mono text-small text-muted">{col.length}</span>
            </header>
            <div className="flex max-h-[calc(100dvh-380px)] min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {col.length === 0 && <p className="px-1 py-2 text-small text-muted">Aucun lead à cette étape.</p>}
              {col.map((l) => (
                <Card
                  key={l.id}
                  lead={l}
                  selected={selected.has(l.id)}
                  draggable={canMove}
                  onToggle={() => onToggle(l.id)}
                  onOpen={() => onOpen(l)}
                  onDragStart={(e) => {
                    // Un lead qui fait partie d'une sélection multiple entraîne toute la sélection.
                    const ids = selected.has(l.id) && selected.size > 1 ? [...selected] : [l.id];
                    e.dataTransfer.setData("application/x-harvest-leads", JSON.stringify(ids));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                />
              ))}
            </div>
            <footer className="flex items-center justify-between gap-2 border-t border-rule px-3 py-2 text-small text-muted">
              <span>
                <span className="font-mono">{col.length}</span> {col.length > 1 ? "leads" : "lead"}
              </span>
              <span>
                Valeur <span className="font-mono text-ink">{formatValue(total)}</span>
              </span>
            </footer>
          </section>
        );
      })}
    </div>
  );
}

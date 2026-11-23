"use client";

import { useEffect, useState } from "react";
import { api, describeError, type Lead } from "@/lib/api";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { LeadSummary } from "./lead-summary";
import { Notice } from "./ui";

/** Carte flottante dans l'angle supérieur droit : le détail d'un lead sans quitter la page. Échap ou × la ferme. */
export function LeadPeek({ lead, onClose, onEdit }: { lead: Lead; onClose: () => void; onEdit: () => void }) {
  const { companyId } = useSession();
  const { reload } = useLeads();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  async function toggleVisited() {
    setBusy(true);
    setError(null);
    try {
      await api(`/leads/${lead.id}`, { method: "PATCH", body: { visited: lead.visitedAt === null }, companyId });
      await reload();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      role="dialog"
      aria-label={`Détail de ${lead.name}`}
      className="fixed right-3 top-[68px] z-30 max-h-[calc(100dvh-84px)] w-[calc(100vw-24px)] overflow-y-auto rounded-card border border-frame bg-card p-4 sm:right-6 sm:w-80"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full text-body text-muted hover:bg-field"
      >
        ×
      </button>
      {error && (
        <div className="mb-3">
          <Notice onClose={() => setError(null)}>{error}</Notice>
        </div>
      )}
      <LeadSummary lead={lead} busy={busy} onToggleVisited={toggleVisited} onEdit={onEdit} />
    </aside>
  );
}

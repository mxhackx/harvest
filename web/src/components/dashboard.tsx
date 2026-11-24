"use client";

import { ROUTES } from "@/lib/routes";
import Link from "next/link";
import { useMemo, useState } from "react";
import { savedMessage, type Lead } from "@/lib/api";
import { useLeads } from "@/lib/leads";
import { useTodayEventLeadIds } from "@/lib/today";
import { useSession } from "@/lib/session";
import { LeadMap } from "./lead-map";
import { LeadModal } from "./lead-modal";
import { LeadPeek } from "./lead-peek";
import { Notice, Panel } from "./ui";

const linkStyle = "shrink-0 whitespace-nowrap text-small font-medium text-link underline decoration-dotted decoration-2 underline-offset-4";

export function Dashboard() {
  const { me, companyId } = useSession();
  const { leads, reload, error, clearError } = useLeads();
  const canRead = me.memberships[0].permissions.some((p) => p.permission === "lead:read");
  const [editing, setEditing] = useState<Lead | null>(null);
  const todayIds = useTodayEventLeadIds(me.memberships[0].permissions.some((p) => p.permission === "event:read"), companyId);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { toVisit, visited } = useMemo(() => {
    const all = leads ?? [];
    // « à visiter » = étape « à visiter » et pas encore visité ; un lead déjà intéressé ou payé n'est plus à prospecter
    return { toVisit: all.filter((l) => l.status === "to_visit" && !l.visitedAt), visited: all.filter((l) => l.visitedAt) };
  }, [leads]);

  // la carte flottante se relit dans la liste : elle suit les changements (visite cochée, fiche modifiée)
  const peek = leads?.find((l) => l.id === peekId) ?? null;
  const firstName = me.user.name.split(/\s+/)[0];

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h1 className="font-display text-title font-semibold">Bonjour {firstName}</h1>
        <p className="text-small text-muted">
          {!canRead
            ? "Vous n'avez pas accès aux leads."
            : leads === null
              ? "Chargement…"
              : toVisit.length === 0
                ? "Rien à visiter pour l'instant."
                : `${toVisit.length} ${toVisit.length > 1 ? "lieux" : "lieu"} à visiter, ${visited.length} déjà ${visited.length > 1 ? "visités" : "visité"}.`}
        </p>
      </div>

      {(notice || error) && <Notice onClose={() => (notice ? setNotice(null) : clearError())}>{notice ?? error}</Notice>}

      {/* moitié haute : ce qui attend aujourd'hui */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Panel title="Aujourd'hui" description="Votre périmètre en un coup d'œil">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["À visiter", toVisit.length],
                ["Visités", visited.length],
                ["Total", (leads ?? []).length],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-control bg-field px-2 py-3">
                <dd className="font-mono text-title font-semibold">{leads === null ? "–" : n}</dd>
                <dt className="text-small text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel
          title="Prochaines visites"
          description="Les premiers lieux de votre tournée"
          action={
            <Link href={ROUTES.leads} className={linkStyle}>
              Tout afficher
            </Link>
          }
        >
          {toVisit.length === 0 ? (
            <p className="text-small text-muted">Rien à décider. Ajoutez un lead pour préparer une tournée.</p>
          ) : (
            <ul className="flex flex-col">
              {toVisit.slice(0, 5).map((l, i) => (
                <li key={l.id} className={i > 0 ? "border-t border-rule" : ""}>
                  <button
                    type="button"
                    onClick={() => setPeekId(peekId === l.id ? null : l.id)}
                    aria-haspopup="dialog"
                    aria-expanded={peekId === l.id}
                    className={`flex w-full items-baseline justify-between gap-4 rounded-control px-2 py-2 text-left hover:bg-field ${peekId === l.id ? "bg-accent-soft" : ""}`}
                  >
                    <span className="truncate text-body font-medium">{l.name}</span>
                    <span className="truncate text-small text-muted">{[l.sector, l.address].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* moitié basse : la carte de tournée */}
      <Panel flush title="Carte de tournée" description="Les leads du jour (créés, visités ou planifiés aujourd’hui), reliés par un parcours : rouge à visiter, bleu intéressé, vert clair maquette envoyée, vert vif acompte payé">
        <LeadMap leads={leads ?? []} todayIds={todayIds} onChanged={reload} onOpen={setEditing} />
      </Panel>
    
      {peek && !editing && (
        <LeadPeek
          lead={peek}
          onClose={() => setPeekId(null)}
          onEdit={() => {
            setEditing(peek);
            setPeekId(null);
          }}
        />
      )}

      {editing && (
        <LeadModal
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, mode) => {
            setEditing(null);
            setNotice(savedMessage(saved, mode));
            reload();
          }}
          onDeleted={(gone) => {
            setEditing(null);
            setNotice(`« ${gone.name} » supprimé.`);
            reload();
          }}
        />
      )}
    </div>
  );
}

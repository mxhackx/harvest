"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { LeadMap } from "./lead-map";
import { Notice, Panel } from "./ui";

const linkStyle = "shrink-0 whitespace-nowrap text-small font-medium text-link underline decoration-dotted decoration-2 underline-offset-4";

export function Dashboard() {
  const { me } = useSession();
  const { leads, reload, error, clearError } = useLeads();
  const canRead = me.memberships[0].permissions.some((p) => p.permission === "lead:read");

  const { toVisit, visited } = useMemo(() => {
    const all = leads ?? [];
    return { toVisit: all.filter((l) => !l.visitedAt), visited: all.filter((l) => l.visitedAt) };
  }, [leads]);

  const firstName = me.user.name.split(/\s+/)[0];

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h1 className="font-serif text-title font-semibold">Bonjour {firstName}</h1>
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

      {error && <Notice onClose={clearError}>{error}</Notice>}

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
            <Link href="/leads" className={linkStyle}>
              Tout afficher
            </Link>
          }
        >
          {toVisit.length === 0 ? (
            <p className="text-small text-muted">Rien à décider. Ajoutez un lead pour préparer une tournée.</p>
          ) : (
            <ul className="flex flex-col">
              {toVisit.slice(0, 5).map((l, i) => (
                <li key={l.id} className={`flex items-baseline justify-between gap-4 py-2 ${i > 0 ? "border-t border-rule" : ""}`}>
                  <span className="truncate text-body font-medium">{l.name}</span>
                  <span className="truncate text-small text-muted">{[l.sector, l.address].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* moitié basse : la carte de tournée */}
      <Panel flush title="Carte de tournée" description="Repères bleus : à visiter · repères verts : déjà visités">
        <LeadMap leads={leads ?? []} onChanged={reload} />
      </Panel>
    </div>
  );
}

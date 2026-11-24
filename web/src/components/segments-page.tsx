"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, describeError } from "@/lib/api";
import { applyLeadView, describeFilters } from "@/lib/lead-filters";
import { useLeads } from "@/lib/leads";
import { ROUTES } from "@/lib/routes";
import { sanitizeSegment, type Segment } from "@/lib/segments";
import { useSession } from "@/lib/session";
import { Notice } from "./ui";

/** Segments : vos vues de leads enregistrées, avec leur taille. On les crée depuis la page Leads (Filtrer, puis Segments). */
export function SegmentsPage() {
  const { me, companyId } = useSession();
  const { leads } = useLeads();
  const [list, setList] = useState<Segment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Segment[]>("/segments", { companyId })
      .then(setList)
      .catch((e) => setError(describeError(e)));
  }, [companyId]);

  const sizes = useMemo(() => new Map((list ?? []).map((s) => [s.id, leads ? applyLeadView(leads, sanitizeSegment(s.config), me.user.id).length : null])), [list, leads, me.user.id]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-title font-semibold">Segments</h1>
        <p className="text-small text-muted">
          Des listes de leads qui se mettent à jour toutes seules selon des critères. Pour en créer un, filtrez la page{" "}
          <Link href={ROUTES.leads} className="text-link underline decoration-dotted decoration-2 underline-offset-4">Leads</Link>, puis « Segments › Enregistrer la vue actuelle ».
        </p>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <section className="overflow-hidden rounded-card border border-border bg-card">
        {list === null ? (
          <p className="px-[18px] py-4 text-small text-muted">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="px-[18px] py-10 text-center text-small text-muted">Aucun segment pour l’instant.</p>
        ) : (
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-rule bg-field text-left text-small text-muted">
                <th className="px-4 py-2 font-medium">Nom</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Taille</th>
                <th className="px-3 py-2 font-medium">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {list.map((s) => (
                <tr key={s.id} className="hover:bg-field">
                  <td className="px-4 py-2">
                    <Link href={ROUTES.segment(s.id)} className="font-medium text-link hover:underline">{s.name}</Link>
                    {s.description && <p className="text-small text-muted">{s.description}</p>}
                  </td>
                  <td className="px-3 py-2 text-small">Dynamique</td>
                  <td className="px-3 py-2 text-right font-mono">{sizes.get(s.id) ?? "…"}</td>
                  <td className="px-3 py-2 text-small text-muted">{new Date(s.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {list && list.length > 0 && <p className="text-small text-muted">{list.length} segment{list.length > 1 ? "s" : ""} · {describeFilters(sanitizeSegment(list[0].config)).length > 0 ? "chacun filtre vos leads en direct" : ""}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import type { Region, Wave } from "@/lib/waves";
import { Notice } from "./ui";
import { WavesMap } from "./waves-map";

/** Carte des vagues : le globe pour situer, la carte pour agir. Les couleurs disent où en est chaque région. */
export function WavesMapPage() {
  const { companyId } = useSession();
  const { leads } = useLeads();
  const [data, setData] = useState<{ regions: Region[]; waves: Wave[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Region[]>("/regions", { companyId }), api<Wave[]>("/waves", { companyId })])
      .then(([regions, waves]) => setData({ regions, waves }))
      .catch((e) => setError(describeError(e)));
  }, [companyId]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-title font-semibold">Carte</h1>
        <p className="text-small text-muted">Faites tourner le globe et cliquez sur un endroit : la carte s’y rend. Chaque région prend la couleur de sa vague.</p>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <WavesMap regions={data?.regions ?? []} waves={data?.waves ?? []} leads={leads ?? []} />
    </div>
  );
}

"use client";

import { useStages } from "@/lib/stages-store";
import { stageOf } from "@/lib/stages";

/** Étiquette d'étape : 22 px de haut, rayon 6, 13 px gras ; la puce reprend la couleur du point sur la carte. */
export function StatusTag({ status }: { status: string }) {
  const { stages } = useStages();
  const stage = stageOf(stages, status);
  const look = stage.kind === "won" ? "bg-forest-soft text-forest" : stage.kind === "lost" ? "bg-field text-muted" : "bg-accent-soft text-accent-press";
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-md px-[9px] text-small font-bold ${look}`}>
      {/* même couleur que le point sur la carte : l'étiquette sert de légende */}
      <span aria-hidden className="size-2 rounded-full border border-ink/15" style={{ background: stage.color }} />
      {stage.name}
    </span>
  );
}

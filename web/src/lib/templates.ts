import { MINIMAL_CSV, MINIMAL_JSON, SAMPLE_CSV, SAMPLE_JSON } from "./lead-fields";

/** Modèles téléchargeables : générés depuis la même description de champs que la documentation. */
export const TEMPLATES = {
  "leads-modele.csv": { type: "text/csv; charset=utf-8", body: "﻿" + SAMPLE_CSV, label: "Modèle CSV complet" },
  "leads-modele.json": { type: "application/json; charset=utf-8", body: SAMPLE_JSON, label: "Modèle JSON complet" },
  "leads-minimal.csv": { type: "text/csv; charset=utf-8", body: "﻿" + MINIMAL_CSV, label: "Modèle CSV minimal" },
  "leads-minimal.json": { type: "application/json; charset=utf-8", body: MINIMAL_JSON, label: "Modèle JSON minimal" },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export function templateResponse(name: TemplateName) {
  const t = TEMPLATES[name];
  return new Response(t.body, {
    headers: {
      "content-type": t.type,
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "public, max-age=3600",
    },
  });
}

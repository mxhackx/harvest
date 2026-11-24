export type FieldType = "text" | "number" | "date" | "select";
export type FieldDef = { id: string; label: string; type: FieldType; options: string[] };
export type CustomInput = Record<string, string | number | null>;

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

/**
 * Applique des valeurs saisies aux valeurs actuelles d'un lead, en vérifiant chacune selon le type de son champ.
 * `null` (ou une chaîne vide) efface la valeur. Renvoie les valeurs à enregistrer, ou le premier problème.
 */
export function mergeCustom(defs: FieldDef[], current: Record<string, string | number>, input: CustomInput): { ok: true; value: Record<string, string | number> } | { ok: false; field: string; message: string } {
  const out = { ...current };
  for (const [id, raw] of Object.entries(input)) {
    const def = defs.find((d) => d.id === id);
    if (!def) return { ok: false, field: id, message: "champ inconnu" };
    if (raw === null || raw === "") {
      delete out[id];
      continue;
    }
    switch (def.type) {
      case "number":
        if (typeof raw !== "number" || !Number.isFinite(raw)) return { ok: false, field: def.label, message: "un nombre est attendu" };
        out[id] = raw;
        break;
      case "date":
        if (typeof raw !== "string" || !isDate(raw)) return { ok: false, field: def.label, message: "date attendue : AAAA-MM-JJ" };
        out[id] = raw;
        break;
      case "select":
        if (typeof raw !== "string" || !def.options.includes(raw)) return { ok: false, field: def.label, message: "choix inconnu" };
        out[id] = raw;
        break;
      default:
        if (typeof raw !== "string") return { ok: false, field: def.label, message: "un texte est attendu" };
        out[id] = raw.trim();
    }
  }
  // une valeur dont le champ a été supprimé ne reste pas : on ne garde que les champs connus
  for (const id of Object.keys(out)) if (!defs.some((d) => d.id === id)) delete out[id];
  return { ok: true, value: out };
}

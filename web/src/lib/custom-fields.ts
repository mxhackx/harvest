export type FieldType = "text" | "number" | "date" | "select";
export type CustomField = { id: string; label: string; type: FieldType; options: string[] };

export const TYPE_LABEL: Record<FieldType, string> = { text: "Texte", number: "Nombre", date: "Date", select: "Liste de choix" };

/** Valeur saisie → valeur envoyée : vide = null (efface), nombre lu avec virgule ou point, le reste tel quel. */
export function parseCustomInput(type: FieldType, raw: string): string | number | null {
  const v = raw.trim();
  if (v === "") return null;
  if (type === "number") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : v; // une saisie illisible part telle quelle : l'API la refuse avec un message
  }
  return v;
}

/** « Petite, Grande ;  Moyenne » → ["Petite", "Grande", "Moyenne"] : séparés par virgule, point-virgule ou retour à la ligne. */
export const parseOptions = (raw: string): string[] => [...new Set(raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))];

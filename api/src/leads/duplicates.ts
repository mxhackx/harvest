import { baseName } from "./names.js";

export type Candidate = { id: string; name: string; city: string; phone: string };
export type Group = { reason: "phone" | "name"; ids: string[] };

const digits = (s: string) => s.replace(/\D/g, "");
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Regroupe les leads qui semblent être la même entreprise : même téléphone (au moins 7 chiffres), ou même nom (sans
 * numéro « (2) ») dans la même ville. Un lead ne figure que dans un groupe ; le motif d'un groupe est celui de sa première règle.
 */
export function findDuplicateGroups(rows: Candidate[]): Group[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  for (const r of rows) parent.set(r.id, r.id);
  const reason = new Map<string, "phone" | "name">();
  const link = (keys: Map<string, string>, key: string, id: string, why: "phone" | "name") => {
    const other = keys.get(key);
    if (other === undefined) return void keys.set(key, id);
    const [a, b] = [find(other), find(id)];
    if (a !== b) {
      parent.set(b, a);
      if (!reason.has(a)) reason.set(a, why);
    }
  };
  const byPhone = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const r of rows) {
    const d = digits(r.phone);
    if (d.length >= 7) link(byPhone, d, r.id, "phone");
    if (r.city.trim()) link(byName, `${norm(baseName(r.name))}|${norm(r.city)}`, r.id, "name");
  }
  const groups = new Map<string, string[]>();
  for (const r of rows) groups.set(find(r.id), [...(groups.get(find(r.id)) ?? []), r.id]);
  return [...groups.entries()].filter(([, ids]) => ids.length > 1).map(([root, ids]) => ({ reason: reason.get(root) ?? "name", ids }));
}

/** Champs texte d'un lead gardé : s'ils sont vides, on reprend ceux du doublon. */
export const FILLABLE = ["sector", "address", "city", "landmark", "whatsapp", "facebook", "website", "googleMapsUrl", "phone", "service"] as const;

export type Person = { id: string; name: string };

/** « Salut @ko » → { query: "ko", start: 6 } : la mention en cours de frappe, collée à la fin du texte. null sinon. */
export function activeMention(text: string): { query: string; start: number } | null {
  const m = /(^|\s)@([^\s@]*)$/.exec(text);
  return m ? { query: m[2], start: text.length - m[2].length - 1 } : null;
}

/** Personnes dont le nom commence par ce qui est tapé (insensible à la casse et aux accents). */
export function suggest(people: Person[], query: string, limit = 5): Person[] {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = fold(query);
  return people.filter((p) => fold(p.name).startsWith(q) || fold(p.name).split(/\s+/).some((w) => w.startsWith(q))).slice(0, limit);
}

/** Remplace la mention en cours par « @Nom Complet » suivi d'une espace. */
export function applyMention(text: string, person: Person): string {
  const a = activeMention(text);
  return a ? `${text.slice(0, a.start)}@${person.name} ` : text;
}

/** Identifiants des personnes choisies dont « @Nom » figure toujours dans le texte (une mention effacée n'est pas envoyée). */
export function mentionIds(text: string, picked: Person[]): string[] {
  return [...new Set(picked.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id))];
}

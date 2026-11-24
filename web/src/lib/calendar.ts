import type { CalEvent } from "./api";

export const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const pad = (n: number) => String(n).padStart(2, "0");
/** Clé « AAAA-MM-JJ » dans le fuseau de l'utilisateur. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Les jours affichés pour un mois : des semaines entières, du lundi au dimanche. */
export function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7; // lundi = 0
  const start = addDays(first, -offset);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const weeks = Math.ceil((offset + last.getDate()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

/** Période à demander à l'API pour remplir la grille (fin exclue). */
export function gridRange(month: Date): { from: Date; to: Date } {
  const days = monthGrid(month);
  return { from: days[0], to: addDays(days[days.length - 1], 1) };
}

export function toInputs(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return { date: dayKey(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/**
 * Fin saisie (heure, le même jour que le début) : `null` si laissée vide, `"invalid"` si illisible ou si elle ne
 * suit pas le début, sinon l'instant de fin.
 */
export function endFromInputs(date: string, startsAt: Date, endTime: string): Date | null | "invalid" {
  if (!endTime) return null;
  const end = fromInputs(date, endTime);
  return end && end > startsAt ? end : "invalid";
}

/** « AAAA-MM-JJ » + « HH:MM » saisis par l'utilisateur → instant. `null` si invalide. */
export function fromInputs(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  const out = new Date(y, mo - 1, da, h, mi);
  // refuse le 31 février, 25 h, etc. : Date les « corrige » silencieusement
  return out.getFullYear() === y && out.getMonth() === mo - 1 && out.getDate() === da && out.getHours() === h && out.getMinutes() === mi ? out : null;
}

export const formatMonth = (d: Date) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
export const formatDayLong = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(d);
export const formatTime = (iso: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Regroupe les rendez-vous par jour local, triés par heure. */
export function eventsByDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>();
  for (const e of [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const k = dayKey(new Date(e.startsAt));
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return map;
}

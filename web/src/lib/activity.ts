export type ActivityKind = "note" | "call" | "message" | "visit" | "email" | "created" | "stage_change" | "visited" | "assigned";

export type Activity = {
  id: string;
  leadId: string;
  kind: ActivityKind;
  body: string;
  meta: Record<string, unknown> | null;
  occurredAt: string;
  authorId: string | null;
  authorName: string | null;
};

export type Contact = {
  id: string;
  leadId: string;
  name: string;
  role: string;
  phone: string;
  whatsapp: string;
  email: string;
  notes: string;
  isPrimary: boolean;
};

/** Types que l'utilisateur peut saisir ; les autres sont écrits par le système et ne se modifient pas. */
export const MANUAL_KINDS: { value: ActivityKind; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call", label: "Appel" },
  { value: "message", label: "Message" },
  { value: "visit", label: "Visite" },
  { value: "email", label: "E-mail" },
];

export const isManualKind = (k: ActivityKind) => MANUAL_KINDS.some((m) => m.value === k);

export const KIND_LABEL: Record<ActivityKind, string> = {
  note: "Note",
  call: "Appel",
  message: "Message",
  visit: "Visite",
  email: "E-mail",
  created: "Création",
  stage_change: "Étape",
  visited: "Visite",
  assigned: "Attribution",
};

type StageRef = { name?: string };
const stageName = (v: unknown) => (v && typeof v === "object" ? ((v as StageRef).name ?? "") : "");

/** Phrase décrivant un événement du système ; les saisies manuelles affichent leur propre texte. */
export function describeActivity(a: Pick<Activity, "kind" | "meta">): string {
  const m = a.meta ?? {};
  switch (a.kind) {
    case "created":
      return m.source === "import" ? "Lead importé" : "Lead créé";
    case "stage_change": {
      const from = stageName(m.from);
      const to = stageName(m.to);
      const base = from && to ? `Étape : ${from} → ${to}` : to ? `Étape : ${to}` : "Changement d'étape";
      return typeof m.lostReason === "string" && m.lostReason ? `${base} (${m.lostReason})` : base;
    }
    case "visited":
      return m.visited === false ? "Remis à visiter" : "Marqué visité";
    case "assigned": {
      const to = stageName(m.to);
      const from = stageName(m.from);
      return to ? (from ? `Attribué : ${from} → ${to}` : `Attribué à ${to}`) : "Lead attribué";
    }
    default:
      return KIND_LABEL[a.kind];
  }
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** « à l'instant », « il y a 5 min », « hier », puis la date : lisible d'un coup d'œil dans un fil. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  const diff = now.getTime() - t.getTime();
  if (diff < MIN) return "à l'instant";
  if (diff < HOUR) return `il y a ${Math.floor(diff / MIN)} min`;
  if (diff < DAY && t.toDateString() === now.toDateString()) return `il y a ${Math.floor(diff / HOUR)} h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (t.toDateString() === yesterday.toDateString()) return `hier à ${time}`;
  const sameYear = t.getFullYear() === now.getFullYear();
  const date = t.toLocaleDateString("fr-FR", sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
  return `${date} à ${time}`;
}

export type Webhook = { id: string; url: string; events: string[]; active: boolean; failures: number; lastStatus: number | null; lastAt: string | null };

export const EVENT_LABEL: Record<string, string> = {
  "lead.created": "Lead créé",
  "lead.updated": "Lead modifié",
  "lead.deleted": "Lead mis à la corbeille",
  "wave.closed": "Vague clôturée",
};

/** État lisible d'un webhook : éteint (trop d'échecs), jamais appelé, dernier envoi réussi ou en échec. */
export function webhookState(h: Pick<Webhook, "active" | "lastStatus" | "failures">): { label: string; ok: boolean } {
  if (!h.active) return { label: `Éteint après ${h.failures} échecs de suite`, ok: false };
  if (h.lastStatus === null) return { label: "Jamais appelé", ok: true };
  if (h.lastStatus >= 200 && h.lastStatus < 300) return { label: `Dernier envoi réussi (${h.lastStatus})`, ok: true };
  return { label: `Dernier envoi en échec (${h.lastStatus})`, ok: false };
}

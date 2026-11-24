export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type Ticket = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  leadId: string | null;
  leadName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  comments?: { id: string; body: string; createdAt: string; authorName: string | null }[];
};
export type KbArticle = { id: string; title: string; body: string; tags: string[]; updatedAt: string; excerpt?: string };

export const STATUS_LABEL: Record<TicketStatus, string> = { open: "Ouvert", in_progress: "En cours", resolved: "Résolu", closed: "Fermé" };
export const PRIORITY_LABEL: Record<TicketPriority, string> = { low: "Basse", normal: "Normale", high: "Haute", urgent: "Urgente" };
export const STATUS_TOKEN: Record<TicketStatus, string> = { open: "--color-wave-overdue", in_progress: "--color-wave-active", resolved: "--color-wave-closed", closed: "--color-neutral" };
export const PRIORITY_TOKEN: Record<TicketPriority, string> = { low: "--color-neutral", normal: "--color-wave-active", high: "--color-wave-planned", urgent: "--color-wave-overdue" };

/** « mot-clé, autre mot, mot-clé » → ["mot-clé", "autre mot"] (sans doublon ni vide). */
export const parseTags = (raw: string): string[] => [...new Set(raw.split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10);

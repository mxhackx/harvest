import type { Line } from "./quotes";

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";
export type Invoice = {
  id: string;
  leadId: string;
  quoteId: string | null;
  number: string;
  title: string;
  status: InvoiceStatus;
  lines: Line[];
  taxRate: number;
  dueOn: string | null;
  notes: string;
  subtotal: number;
  tax: number;
  total: number;
  sentAt: string | null;
  paidAt: string | null;
  leadName?: string;
};

export const INVOICE_LABEL: Record<InvoiceStatus, string> = { draft: "Brouillon", sent: "Envoyée", paid: "Payée", cancelled: "Annulée" };
export const INVOICE_TOKEN: Record<InvoiceStatus, string> = { draft: "--color-neutral", sent: "--color-wave-active", paid: "--color-wave-closed", cancelled: "--color-wave-overdue" };

/** Une facture envoyée dont l'échéance est passée est en retard de paiement. */
export const isOverdue = (i: Pick<Invoice, "status" | "dueOn">, today = new Date().toISOString().slice(0, 10)): boolean => i.status === "sent" && !!i.dueOn && i.dueOn < today;

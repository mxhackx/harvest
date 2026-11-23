export type Template = { id: string; name: string; channel: "whatsapp" | "email"; body: string };
export type Recipient = { label: string; name: string; whatsapp: string; phone: string; email: string };

export const TEMPLATE_VARIABLES = [
  { token: "{{contact}}", label: "Nom du contact" },
  { token: "{{entreprise}}", label: "Nom du lead (l'entreprise)" },
  { token: "{{moi}}", label: "Votre nom" },
] as const;

/** Remplace `{{contact}}`, `{{entreprise}}`, `{{moi}}` ; une variable inconnue reste telle quelle (visible, donc corrigeable). */
export function renderTemplate(body: string, vars: { contact: string; entreprise: string; moi: string }): string {
  return body.replace(/\{\{\s*(contact|entreprise|moi)\s*\}\}/g, (_, key: keyof typeof vars) => vars[key]);
}

/** Lien WhatsApp avec le texte prérempli ; `null` si le numéro est inutilisable (moins de 6 chiffres). */
export function whatsappUrl(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

export function mailtoUrl(email: string, text: string, subject = ""): string | null {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? `mailto:${email}?${subject ? `subject=${encodeURIComponent(subject)}&` : ""}body=${encodeURIComponent(text)}` : null;
}

/** Lien d'envoi selon le canal du modèle et les coordonnées du destinataire ; `null` s'il manque le numéro ou l'adresse. */
export function sendUrl(channel: Template["channel"], r: Pick<Recipient, "whatsapp" | "phone" | "email">, text: string, subject = ""): string | null {
  return channel === "email" ? mailtoUrl(r.email, text, subject) : whatsappUrl(r.whatsapp || r.phone, text);
}

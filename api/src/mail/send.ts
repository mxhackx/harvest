import { config } from "../config.js";

export type Mail = { to: string; subject: string; html: string; text: string; /** adresse où arrivent les réponses (ex. celle de la personne qui écrit depuis le CRM) */ replyTo?: string };

/** Boîte d'envoi des tests : rien ne part sur le réseau quand NODE_ENV=test. */
export const outbox: Mail[] = [];

/**
 * Envoie un e-mail via l'API de Resend. Ne lève jamais d'exception : renvoie `true` si Resend a accepté le message.
 * Un échec d'envoi ne doit pas empêcher l'action de l'utilisateur (l'invitation reste créée, le lien s'affiche).
 */
export async function sendMail(mail: Mail, log?: { warn: (o: object, m: string) => void }): Promise<boolean> {
  if (process.env.NODE_ENV === "test") {
    outbox.push(mail);
    return true;
  }
  if (!config.mail.apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${config.mail.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: config.mail.from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log?.warn({ status: res.status, body: (await res.text()).slice(0, 300) }, "mail refused");
      return false;
    }
    return true;
  } catch (err) {
    log?.warn({ err }, "mail failed");
    return false;
  }
}

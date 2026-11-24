import type { Mail } from "./send.js";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, intro: string, button: string, url: string, outro: string): { html: string; text: string } {
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f5f7;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#14181f">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="background:#fff;border:1px solid #e3e6ea;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:.04em;color:#0868c9">HARVEST</p>
<h1 style="margin:0 0 16px;font-size:20px">${esc(title)}</h1>
<p style="margin:0 0 20px;line-height:1.5">${intro}</p>
<p style="margin:0 0 24px"><a href="${esc(url)}" style="display:inline-block;background:#0868c9;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${esc(button)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#5b6472;line-height:1.5">${outro}</p>
<p style="margin:0;font-size:12px;color:#8a93a0;word-break:break-all">Si le bouton ne fonctionne pas : ${esc(url)}</p>
</div></div></body></html>`;
  const plain = (s: string) => s.replace(/<[^>]+>/g, "");
  return { html, text: `${title}\n\n${plain(intro)}\n\n${button} : ${url}\n\n${plain(outro)}\n` };
}

export function invitationMail(to: string, d: { inviter: string; company: string; url: string; days: number }): Mail {
  const { html, text } = layout(
    `${d.inviter} vous invite sur Harvest`,
    `<strong>${esc(d.inviter)}</strong> vous invite à rejoindre <strong>${esc(d.company)}</strong>. Créez votre compte ou connectez-vous avec cette adresse pour accepter.`,
    "Rejoindre l’équipe",
    d.url,
    `Ce lien est personnel et valable ${d.days} jours. Si vous ne connaissez pas ${esc(d.inviter)}, ignorez ce message.`,
  );
  return { to, subject: `${d.inviter} vous invite à rejoindre ${d.company} sur Harvest`, html, text };
}

export function resetMail(to: string, d: { url: string; minutes: number }): Mail {
  const { html, text } = layout(
    "Réinitialiser votre mot de passe",
    "Vous avez demandé à choisir un nouveau mot de passe pour votre compte Harvest.",
    "Choisir un nouveau mot de passe",
    d.url,
    `Ce lien est valable ${d.minutes} minutes et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.`,
  );
  return { to, subject: "Réinitialisation de votre mot de passe Harvest", html, text };
}

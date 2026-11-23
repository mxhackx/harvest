"use client";

import { useEffect, useMemo, useState } from "react";
import { api, describeError } from "@/lib/api";
import { renderTemplate, sendUrl, type Recipient, type Template } from "@/lib/messages";
import { useSession } from "@/lib/session";
import { Button, Modal, Notice, Select, TextArea } from "./ui";

/**
 * Envoi d'un message à partir d'un modèle : choix du modèle et du destinataire, texte modifiable, puis ouverture de
 * WhatsApp (ou du client e-mail). L'envoi est inscrit dans le fil d'activité du lead.
 */
export function SendMessageModal({
  lead,
  recipients,
  onClose,
  onSent,
}: {
  lead: { id: string; name: string };
  recipients: Recipient[];
  onClose: () => void;
  onSent?: () => void;
}) {
  const { me, companyId } = useSession();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [who, setWho] = useState(0);
  // retouche manuelle du texte, valable seulement pour le couple modèle + destinataire où elle a été faite
  const [edit, setEdit] = useState<{ key: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Template[]>("/templates", { companyId })
      .then((t) => {
        setTemplates(t);
        setTemplateId(t[0]?.id ?? "");
      })
      .catch((e) => setError(describeError(e)));
  }, [companyId]);

  const template = templates?.find((t) => t.id === templateId);
  const recipient = recipients[who];
  const vars = useMemo(() => ({ contact: recipient?.name ?? "", entreprise: lead.name, moi: me.user.name }), [recipient, lead.name, me.user.name]);

  // le texte repart du modèle quand on change de modèle ou de destinataire ; la personne peut ensuite le retoucher
  const key = `${templateId}:${who}`;
  const text = edit && edit.key === key ? edit.text : template ? renderTemplate(template.body, vars) : "";

  const url = template && recipient ? sendUrl(template.channel, recipient, text, lead.name) : null;

  async function send() {
    if (!url || !template) return;
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      const channel = template.channel === "email" ? "E-mail" : "WhatsApp";
      await api(`/leads/${lead.id}/activities`, {
        method: "POST",
        body: { kind: template.channel === "email" ? "email" : "message", body: `${channel} à ${recipient.name || recipient.label} : ${text}`.slice(0, 2000) },
        companyId,
      });
      onSent?.();
      onClose();
    } catch (e) {
      setError(`Message ouvert, mais non inscrit dans le fil : ${describeError(e)}`);
    }
  }

  return (
    <Modal title="Envoyer un message" description={lead.name} onClose={onClose} width="max-w-[560px]">
      <div className="flex flex-col gap-4">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {templates && templates.length === 0 ? (
          <p className="text-small text-muted">Aucun modèle pour l’instant. Créez-en dans CRM › Modèles de messages.</p>
        ) : (
          <>
            <Select label="Modèle" value={templateId} onChange={(e) => setTemplateId(e.target.value)} options={(templates ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.channel === "email" ? "e-mail" : "WhatsApp"})` }))} />
            {recipients.length > 0 ? (
              <Select label="Destinataire" value={String(who)} onChange={(e) => setWho(Number(e.target.value))} options={recipients.map((r, i) => ({ value: String(i), label: r.label }))} />
            ) : (
              <p className="text-small text-muted">Aucun contact ni numéro sur ce lead.</p>
            )}
            <TextArea label="Message" rows={6} value={text} onChange={(e) => setEdit({ key, text: e.target.value })} maxLength={1900} />
            {template && recipient && !url && (
              <p className="text-small text-fail">{template.channel === "email" ? "Ce destinataire n’a pas d’adresse e-mail." : "Ce destinataire n’a pas de numéro utilisable."}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" className="w-auto" onClick={onClose}>Annuler</Button>
              <Button className="w-auto" disabled={!url || !text.trim()} onClick={send}>
                {template?.channel === "email" ? "Ouvrir l’e-mail" : "Ouvrir WhatsApp"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

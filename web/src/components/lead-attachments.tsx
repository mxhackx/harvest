"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { ACCEPT, formatSize, refusal, type Attachment } from "@/lib/attachments";
import { useSession } from "@/lib/session";
import { DownloadIcon, TrashIcon, UploadIcon } from "./icons";
import { Notice } from "./ui";

const icon = "flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink";

/** Les pièces jointes d'un lead : envoyées directement au stockage privé, téléchargées par un lien d'une minute. */
export function LeadAttachments({ leadId, canWrite }: { leadId: string; canWrite: boolean }) {
  const { companyId } = useSession();
  const [data, setData] = useState<{ enabled: boolean; items: Attachment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(
    () => api<{ enabled: boolean; items: Attachment[] }>(`/leads/${leadId}/attachments`, { companyId }).then(setData).catch(() => setData({ enabled: false, items: [] })),
    [leadId, companyId],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function send(file: File) {
    const no = refusal(file);
    if (no) return setError(no);
    setError(null);
    setSending(file.name);
    try {
      const { id, uploadUrl } = await api<{ id: string; uploadUrl: string }>(`/leads/${leadId}/attachments`, { companyId, body: { name: file.name, size: file.size, type: file.type } });
      const res = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!res.ok) throw new Error("envoi refusé par le stockage");
      await api(`/attachments/${id}/complete`, { method: "POST", companyId, body: {} });
      await load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSending(null);
    }
  }
  const download = (a: Attachment) =>
    api<{ url: string }>(`/attachments/${a.id}/url`, { companyId })
      // le stockage répond avec « télécharger » : la page courante reste affichée
      .then(({ url }) => window.location.assign(url))
      .catch((e) => setError(describeError(e)));
  const remove = async (a: Attachment) => {
    if (!window.confirm(`Supprimer « ${a.name} » ?`)) return;
    await api(`/attachments/${a.id}`, { method: "DELETE", companyId }).catch((e) => setError(describeError(e)));
    await load();
  };

  if (data === null) return <p className="text-small text-muted">Chargement…</p>;
  return (
    <div className="flex flex-col gap-2">
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {data.items.length === 0 && <p className="text-small text-muted">Aucune pièce jointe.</p>}
      <ul className="flex flex-col gap-1">
        {data.items.map((a) => (
          <li key={a.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-small font-medium">{a.name}</span>
              <span className="block text-caption text-muted">{[formatSize(a.size), new Date(a.createdAt).toLocaleDateString("fr-FR"), a.uploadedByName].filter(Boolean).join(" · ")}</span>
            </span>
            {data.enabled && <button type="button" aria-label={`Télécharger ${a.name}`} className={icon} onClick={() => download(a)}><DownloadIcon size={15} /></button>}
            {data.enabled && canWrite && <button type="button" aria-label={`Supprimer ${a.name}`} className={icon} onClick={() => remove(a)}><TrashIcon size={15} /></button>}
          </li>
        ))}
      </ul>
      {!data.enabled ? (
        <p className="text-small text-muted">Le stockage de fichiers n’est pas configuré sur ce serveur.</p>
      ) : (
        canWrite && (
          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-control border border-frame text-small font-medium hover:bg-field focus-within:outline-2 focus-within:outline-accent">
            <UploadIcon size={15} /> {sending ? `Envoi de ${sending}…` : "Ajouter un fichier (image ou PDF, 50 Mo)"}
            <input type="file" accept={ACCEPT.join(",")} aria-label="Ajouter un fichier" disabled={!!sending} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) send(f); }} />
          </label>
        )
      )}
    </div>
  );
}

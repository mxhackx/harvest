"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { useCrumb } from "@/lib/crumb";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { PRIORITY_LABEL, STATUS_LABEL, type Ticket, type TicketPriority, type TicketStatus } from "@/lib/support";
import { Button, Notice, Select, TextArea } from "./ui";

/** Un ticket : son état, son responsable, sa priorité, et le fil de commentaires de l'équipe. */
export function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const canWrite = perms.includes("ticket:update");
  const [t, setT] = useState<Ticket | null>(null);
  const [members, setMembers] = useState<{ userId: string; name: string }[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useCrumb(t?.title);

  useEffect(() => {
    api<Ticket>(`/tickets/${id}`, { companyId }).then(setT).catch((e) => setError(describeError(e)));
  }, [id, companyId, version]);
  useEffect(() => {
    if (perms.includes("member:read")) api<{ userId: string; name: string }[]>("/members", { companyId }).then(setMembers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  if (!t) return error ? <Notice onClose={() => setError(null)}>{error}</Notice> : <p className="text-small text-muted">Chargement…</p>;
  const patch = async (body: Record<string, unknown>) => {
    try {
      await api(`/tickets/${id}`, { method: "PATCH", companyId, body });
      setError(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(describeError(e));
    }
  };
  const send = async () => {
    setBusy(true);
    try {
      await api(`/tickets/${id}/comments`, { companyId, body: { body: comment.trim() } });
      setComment("");
      setVersion((v) => v + 1);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Fil d'Ariane" className="text-small text-muted">
        <Link href={ROUTES.tickets} className="hover:underline">Tickets</Link> › <span className="font-medium text-ink">{t.title}</span>
      </nav>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-card border border-border bg-card p-4">
            <h1 className="font-display text-title font-semibold">{t.title}</h1>
            <p className="mt-1 text-small text-muted">Ouvert le {new Date(t.createdAt).toLocaleDateString("fr-FR")}{t.leadName && <> · client : <Link href={t.leadId ? ROUTES.lead(t.leadId) : "#"} className="text-link hover:underline">{t.leadName}</Link></>}</p>
            {t.description && <p className="mt-3 whitespace-pre-wrap">{t.description}</p>}
          </section>
          <section aria-label="Commentaires" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
            <h2 className="text-small font-semibold uppercase tracking-wide text-muted">Commentaires ({t.comments?.length ?? 0})</h2>
            {(t.comments ?? []).length === 0 && <p className="text-small text-muted">Aucun commentaire.</p>}
            <ul className="flex flex-col gap-3">
              {(t.comments ?? []).map((c) => (
                <li key={c.id} className="rounded-control bg-field p-3">
                  <p className="text-small text-muted"><strong className="text-ink">{c.authorName ?? "Compte supprimé"}</strong> · {new Date(c.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
            {canWrite && (
              <div className="flex flex-col gap-2">
                <TextArea label="Ajouter un commentaire" rows={3} maxLength={3000} value={comment} onChange={(e) => setComment(e.target.value)} />
                <Button className="h-9 w-auto self-end" loading={busy} disabled={!comment.trim()} onClick={send}>Commenter</Button>
              </div>
            )}
          </section>
        </div>
        <aside className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
          <Select label="Statut" value={t.status} disabled={!canWrite} onChange={(e) => patch({ status: e.target.value as TicketStatus })} options={(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
          <Select label="Priorité" value={t.priority} disabled={!canWrite} onChange={(e) => patch({ priority: e.target.value as TicketPriority })} options={(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
          {members.length > 0 ? (
            <Select label="Confié à" value={t.assigneeId ?? ""} disabled={!canWrite} onChange={(e) => patch({ assigneeId: e.target.value || null })} options={[{ value: "", label: "Personne" }, ...members.map((m) => ({ value: m.userId, label: m.name }))]} />
          ) : (
            <p className="text-small text-muted">Confié à : {t.assigneeName ?? "personne"}</p>
          )}
          {t.resolvedAt && <p className="text-small text-muted">Résolu le {new Date(t.resolvedAt).toLocaleDateString("fr-FR")}</p>}
        </aside>
      </div>
    </div>
  );
}

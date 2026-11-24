"use client";

import { ROUTES } from "@/lib/routes";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LOCATION_SOURCE_NOTE, api, describeError, formatValue, type Lead } from "@/lib/api";
import { closeDateLate, effectiveProbability, formatCloseDate, weightedValue } from "@/lib/opportunity";
import { dueLabel } from "@/lib/tasks";
import type { Contact } from "@/lib/activity";
import type { Recipient } from "@/lib/messages";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { stageOf } from "@/lib/stages";
import { useStages } from "@/lib/stages-store";
import { LeadQuotes } from "./lead-quotes";
import { LeadActivity } from "./lead-activity";
import { LeadContacts } from "./lead-contacts";
import { LeadLinks } from "./lead-links";
import { AssignModal } from "./assign-modal";
import { SendMessageModal } from "./send-message-modal";
import { TaskList } from "./task-list";
import { LeadModal } from "./lead-modal";
import { LostReasonModal } from "./lost-reason-modal";
import { PencilIcon } from "./icons";
import { Button, Notice, Panel } from "./ui";

type Tab = "activity" | "contacts" | "tasks" | "quotes";

/** Charge les contacts du lead puis ouvre l'envoi de message : chaque contact, plus le numéro de l'entreprise. */
function MessageLauncher({ lead, onClose, onSent }: { lead: Lead; onClose: () => void; onSent: () => void }) {
  const { companyId } = useSession();
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  useEffect(() => {
    api<Contact[]>(`/leads/${lead.id}/contacts`, { companyId })
      .then((cs) => {
        const list: Recipient[] = cs.map((c) => ({ label: c.role ? `${c.name} (${c.role})` : c.name, name: c.name, whatsapp: c.whatsapp, phone: c.phone, email: c.email }));
        if (lead.whatsapp || lead.phone) list.push({ label: `${lead.name} (numéro de l'entreprise)`, name: lead.contactName, whatsapp: lead.whatsapp, phone: lead.phone, email: "" });
        setRecipients(list);
      })
      .catch(() => setRecipients([]));
  }, [lead, companyId]);
  if (!recipients) return null;
  return <SendMessageModal lead={{ id: lead.id, name: lead.name }} recipients={recipients} onClose={onClose} onSent={onSent} />;
}

/** Page d'un lead : étape du pipeline, informations, fil d'activité et contacts. */
export function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, companyId } = useSession();
  const { leads, reload } = useLeads();
  const { stages } = useStages();
  const [tab, setTab] = useState<Tab>("activity");
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lostAsk, setLostAsk] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [owner, setOwner] = useState<string | null>(null);

  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const canUpdate = perms.includes("lead:update");
  const canAssign = perms.includes("lead:assign") && perms.includes("member:read");
  const lead: Lead | undefined = leads?.find((l) => l.id === id);

  const ownerId = lead?.ownerId;
  useEffect(() => {
    if (!ownerId || !perms.includes("member:read")) return;
    api<{ userId: string; name: string }[]>("/members", { companyId })
      .then((ms) => setOwner(ms.find((m) => m.userId === ownerId)?.name ?? null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, companyId, version]);

  if (leads === null) return <p className="text-small text-muted">Chargement…</p>;
  if (!lead)
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-title font-semibold">Lead introuvable</h1>
        <p className="text-small text-muted">Il a été supprimé, ou il n’est pas dans votre périmètre.</p>
        <Link href={ROUTES.leads} className="text-small font-medium text-accent-press hover:underline">← Retour aux leads</Link>
      </div>
    );

  const current = stageOf(stages, lead.status);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/leads/${id}`, { method: "PATCH", body, companyId });
      setError(null);
      await reload();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  function changeStage(key: string) {
    if (key === lead!.status) return;
    if (stageOf(stages, key).kind === "lost") setLostAsk(key);
    else patch({ status: key });
  }

  const visited = lead.visitedAt !== null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={ROUTES.leads} className="text-small font-medium text-accent-press hover:underline">← Leads</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-title font-semibold leading-snug">{lead.name}</h1>
          {canUpdate && (
            <Button variant="secondary" className="h-9 w-auto" onClick={() => setEditing(true)}>
              <PencilIcon size={16} /> Modifier
            </Button>
          )}
        </div>
      </div>

      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <nav aria-label="Étape du pipeline" className="flex flex-wrap gap-1.5">
        {stages.map((s) => {
          const active = s.key === lead.status;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!canUpdate || busy}
              aria-current={active ? "step" : undefined}
              onClick={() => changeStage(s.key)}
              className={`inline-flex h-9 items-center gap-2 rounded-control border px-3 text-small font-medium disabled:cursor-default ${active ? "border-ink bg-inverse text-on-inverse" : "border-frame bg-card hover:bg-field disabled:hover:bg-card"}`}
            >
              <span aria-hidden className="size-2 rounded-full border border-ink/15" style={{ background: s.color }} />
              {s.name}
            </button>
          );
        })}
      </nav>
      {current.kind === "lost" && lead.lostReason && <p className="text-small text-muted">Motif de perte : {lead.lostReason}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Panel title="Informations">
          <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-2 text-small">
            <dt className="text-muted">Secteur</dt>
            <dd>{lead.sector || "—"}</dd>
            <dt className="text-muted">Contact</dt>
            <dd>{lead.contactName || "—"}</dd>
            <dt className="text-muted">Téléphone</dt>
            <dd className="font-mono">{lead.phone || "—"}</dd>
            <dt className="text-muted">Adresse</dt>
            <dd>{[lead.address, lead.city].filter(Boolean).join(", ") || "—"}</dd>
            {lead.landmark && (<><dt className="text-muted">Repère</dt><dd>{lead.landmark}</dd></>)}
            {lead.service && (<><dt className="text-muted">Service</dt><dd>{lead.service}</dd></>)}
            {lead.estimatedValue !== null && (<><dt className="text-muted">Valeur</dt><dd className="font-mono">{formatValue(lead.estimatedValue)}</dd></>)}
            {current.kind === "open" && (
              <>
                <dt className="text-muted">Probabilité</dt>
                <dd>
                  <span className="font-mono">{effectiveProbability(lead, stages)} %</span>
                  {lead.probability === null && <span className="text-muted"> (selon l’étape)</span>}
                  {weightedValue(lead, stages) !== null && <span className="text-muted"> · pondéré <span className="font-mono">{formatValue(weightedValue(lead, stages)!)}</span></span>}
                </dd>
              </>
            )}
            {lead.expectedCloseOn && (
              <>
                <dt className="text-muted">Conclusion</dt>
                <dd className={closeDateLate(lead.expectedCloseOn, current.kind === "open") ? "font-medium text-fail" : ""}>
                  {formatCloseDate(lead.expectedCloseOn)}
                  {closeDateLate(lead.expectedCloseOn, current.kind === "open") && " · dépassée"}
                </dd>
              </>
            )}
            {current.kind === "open" && (
              <>
                <dt className="text-muted">Prochain suivi</dt>
                <dd>
                  {lead.nextFollowUpAt ? (
                    <button type="button" onClick={() => setTab("tasks")} className="text-left hover:underline">{dueLabel({ dueAt: lead.nextFollowUpAt, doneAt: null })}</button>
                  ) : (
                    <button type="button" onClick={() => setTab("tasks")} className="text-left font-medium text-fail hover:underline">Aucun suivi prévu</button>
                  )}
                </dd>
              </>
            )}
            <dt className="text-muted">Visite</dt>
            <dd>{lead.visitedAt ? new Date(lead.visitedAt).toLocaleDateString("fr-FR") : "Pas encore visité"}</dd>
            {owner && (<><dt className="text-muted">Responsable</dt><dd>{owner}</dd></>)}
            <dt className="text-muted">Créé le</dt>
            <dd>{new Date(lead.createdAt).toLocaleDateString("fr-FR")}</dd>
          </dl>
          <div className="mt-3 flex flex-col gap-3">
            <LeadLinks lead={lead} />
            {LOCATION_SOURCE_NOTE[lead.locationSource] && <p className="text-small text-muted">{LOCATION_SOURCE_NOTE[lead.locationSource]}</p>}
            {canUpdate && (
              <Button variant="secondary" className="h-9" onClick={() => setMessaging(true)}>
                Envoyer un message
              </Button>
            )}
            {canAssign && (
              <Button variant="secondary" className="h-9" onClick={() => setAssigning(true)}>
                Attribuer à…
              </Button>
            )}
            {canUpdate && (
              <Button variant="secondary" className="h-9" loading={busy} onClick={() => patch({ visited: !visited })}>
                {visited ? "Remettre à visiter" : "Marquer visité"}
              </Button>
            )}
          </div>
        </Panel>

        <section className="overflow-hidden rounded-card border border-border bg-card">
          <div role="tablist" aria-label="Détail du lead" className="flex gap-1 border-b border-rule px-3 pt-2">
            {(
              [
                ["activity", "Activité"],
                ["contacts", "Contacts"],
                ["tasks", "Tâches"],
                ["quotes", "Devis"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`h-9 border-b-2 px-3 text-body font-medium ${tab === key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="px-[18px] py-4">
            {tab === "activity" ? (
              <LeadActivity leadId={lead.id} canWrite={canUpdate} version={version} />
            ) : tab === "tasks" ? (
              <TaskList leadId={lead.id} onChanged={reload} />
            ) : tab === "quotes" ? (
              <LeadQuotes leadId={lead.id} canWrite={canUpdate} />
            ) : (
              <LeadContacts leadId={lead.id} canWrite={canUpdate} onChanged={reload} />
            )}
          </div>
        </section>
      </div>

      {editing && (
        <LeadModal
          lead={lead}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await reload();
            setVersion((v) => v + 1);
          }}
          onDeleted={async () => {
            await reload();
            router.push(ROUTES.leads);
          }}
        />
      )}
      {messaging && (
        <MessageLauncher
          lead={lead}
          onClose={() => setMessaging(false)}
          onSent={() => setVersion((v) => v + 1)}
        />
      )}
      {assigning && (
        <AssignModal
          ids={[lead.id]}
          onClose={() => setAssigning(false)}
          onDone={async () => {
            setAssigning(false);
            await reload();
            setVersion((v) => v + 1);
          }}
        />
      )}
      {lostAsk && (
        <LostReasonModal
          count={1}
          stageName={stageOf(stages, lostAsk).name}
          onClose={() => setLostAsk(null)}
          onConfirm={(reason) => {
            const key = lostAsk;
            setLostAsk(null);
            patch({ status: key, lostReason: reason });
          }}
        />
      )}
    </div>
  );
}

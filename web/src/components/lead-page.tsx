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
import { useCrumb } from "@/lib/crumb";
import { useSession } from "@/lib/session";
import { stageOf } from "@/lib/stages";
import { useStages } from "@/lib/stages-store";
import { LeadQuotes } from "./lead-quotes";
import { LeadInvoices } from "./lead-invoices";
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

type Tab = "overview" | "activity" | "tasks";

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
  const [tab, setTab] = useState<Tab>("overview");
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
  useCrumb(lead?.name); // « Admin › CRM › Leads › nom du lead »

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
  const initial = lead.name.trim().charAt(0).toUpperCase() || "?";

  /** Les gestes rapides sous le nom (comme une fiche de CRM) : note, e-mail, appel, tâche, visite. */
  const quick: { label: string; icon: string; onClick: () => void; show: boolean }[] = [
    { label: "Note", icon: "✎", onClick: () => setTab("activity"), show: true },
    { label: "E-mail", icon: "✉", onClick: () => setMessaging(true), show: canUpdate },
    { label: "Appel", icon: "☎", onClick: () => setTab("activity"), show: true },
    { label: "Tâche", icon: "✓", onClick: () => setTab("tasks"), show: true },
    { label: visited ? "À revoir" : "Visité", icon: "⚑", onClick: () => patch({ visited: !visited }), show: canUpdate },
  ];

  return (
    <div className="flex flex-col gap-4">
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

      <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        {/* Colonne de gauche : qui est ce lead, gestes rapides, propriétés */}
        <div className="flex flex-col gap-4">
          <section aria-label="Résumé du lead" className="rounded-card border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-title font-bold text-accent-press">{initial}</span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-title font-semibold leading-snug">{lead.name}</h1>
                <p className="truncate text-small text-muted">{[lead.sector, lead.city].filter(Boolean).join(" · ") || "Lead"}</p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
              <dt className="text-muted">Valeur</dt>
              <dd className="font-mono">{lead.estimatedValue !== null ? formatValue(lead.estimatedValue) : "—"}</dd>
              <dt className="text-muted">Conclusion</dt>
              <dd>{lead.expectedCloseOn ? formatCloseDate(lead.expectedCloseOn) : "—"}</dd>
              <dt className="text-muted">Étape</dt>
              <dd>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 font-medium">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: current.color }} />
                  {current.name}
                </span>
              </dd>
            </dl>
            <div role="group" aria-label="Actions rapides" className="mt-4 flex justify-between gap-1">
              {quick.filter((q) => q.show).map((q) => (
                <button key={q.label} type="button" onClick={q.onClick} disabled={busy} className="flex flex-1 flex-col items-center gap-1 text-small text-muted hover:text-ink">
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-full border border-border bg-field text-body text-ink">{q.icon}</span>
                  {q.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {canUpdate && (
                <Button variant="secondary" className="h-9 w-auto" onClick={() => setEditing(true)}>
                  <PencilIcon size={16} /> Modifier
                </Button>
              )}
              {canAssign && (
                <Button variant="secondary" className="h-9 w-auto" onClick={() => setAssigning(true)}>
                  Attribuer à…
                </Button>
              )}
            </div>
          </section>

          <Panel title="À propos de ce lead">
            <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-small">
              <dt className="text-muted">Type</dt>
              <dd>{lead.visitMode === "remote" ? "Prospect simple (à distance)" : "À visiter en présentiel"}</dd>
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
              {owner && (<><dt className="text-muted">Responsable</dt><dd>{owner}</dd></>)}
              <dt className="text-muted">Visite</dt>
              <dd>{lead.visitedAt ? new Date(lead.visitedAt).toLocaleDateString("fr-FR") : "Pas encore visité"}</dd>
              <dt className="text-muted">Créé le</dt>
              <dd>{new Date(lead.createdAt).toLocaleDateString("fr-FR")}</dd>
            </dl>
            <div className="mt-3 flex flex-col gap-3">
              <LeadLinks lead={lead} />
              {LOCATION_SOURCE_NOTE[lead.locationSource] && <p className="text-small text-muted">{LOCATION_SOURCE_NOTE[lead.locationSource]}</p>}
            </div>
          </Panel>
        </div>

        {/* Centre : aperçu, activité, tâches */}
        <section className="min-w-0 overflow-hidden rounded-card border border-border bg-card">
          <div role="tablist" aria-label="Détail du lead" className="flex gap-1 border-b border-rule px-3 pt-2">
            {([["overview", "Aperçu"], ["activity", "Activité"], ["tasks", "Tâches"]] as const).map(([key, label]) => (
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
            {tab === "overview" ? (
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ["Valeur", lead.estimatedValue !== null ? formatValue(lead.estimatedValue) : "—"],
                    ["Probabilité", current.kind === "open" ? `${effectiveProbability(lead, stages)} %` : "—"],
                    ["Pondéré", weightedValue(lead, stages) !== null ? formatValue(weightedValue(lead, stages)!) : "—"],
                    ["Conclusion", lead.expectedCloseOn ? formatCloseDate(lead.expectedCloseOn) : "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-control bg-field px-3 py-2">
                      <dt className="text-small text-muted">{label}</dt>
                      <dd className={`font-mono font-semibold ${label === "Conclusion" && lead.expectedCloseOn && closeDateLate(lead.expectedCloseOn, current.kind === "open") ? "text-fail" : ""}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
                {current.kind === "open" && (
                  <div className="rounded-control border border-border p-3 text-small">
                    <p className="font-semibold">Prochain suivi</p>
                    <button type="button" onClick={() => setTab("tasks")} className={`mt-1 text-left hover:underline ${lead.nextFollowUpAt ? "" : "font-medium text-fail"}`}>
                      {lead.nextFollowUpAt ? dueLabel({ dueAt: lead.nextFollowUpAt, doneAt: null }) : "Aucun suivi prévu : planifier une tâche"}
                    </button>
                  </div>
                )}
                <div>
                  <p className="mb-2 text-small font-semibold uppercase tracking-wide text-muted">Activité récente</p>
                  <LeadActivity leadId={lead.id} canWrite={false} version={version} />
                </div>
              </div>
            ) : tab === "activity" ? (
              <LeadActivity leadId={lead.id} canWrite={canUpdate} version={version} />
            ) : (
              <TaskList leadId={lead.id} onChanged={reload} />
            )}
          </div>
        </section>

        {/* Colonne de droite : ce qui est associé au lead */}
        <div className="flex flex-col gap-4">
          <Panel title="Contacts">
            <LeadContacts leadId={lead.id} canWrite={canUpdate} onChanged={reload} />
          </Panel>
          <Panel title="Compte">
            {lead.accountId ? (
              <Link href={ROUTES.account(lead.accountId)} className="text-small font-medium text-link underline decoration-dotted decoration-2 underline-offset-4">
                Voir le compte et ses opportunités
              </Link>
            ) : (
              <p className="text-small text-muted">Ce lead n’est rattaché à aucun compte. Modifiez la fiche pour en choisir un ou en créer un.</p>
            )}
          </Panel>
          <Panel title="Devis">
            <LeadQuotes leadId={lead.id} canWrite={canUpdate} />
          </Panel>
          <Panel title="Factures">
            <LeadInvoices leadId={lead.id} />
          </Panel>
        </div>
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

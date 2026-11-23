"use client";

import { useState, type FormEvent } from "react";
import { EVENT_KINDS, EVENT_KIND_LABEL, api, describeError, type CalEvent, type Lead } from "@/lib/api";
import { fromInputs, toInputs } from "@/lib/calendar";
import { useSession } from "@/lib/session";
import { Button, Field, Modal, Notice, Select, TextArea } from "./ui";

/** Création (sans `event`) ou modification d'un rendez-vous. `day` = jour proposé à la création. */
export function EventModal({
  event,
  day,
  leads,
  onClose,
  onSaved,
}: {
  event?: CalEvent;
  day: Date;
  leads: Lead[];
  onClose: () => void;
  onSaved: (e: CalEvent) => void;
}) {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const readOnly = !!event && !perms.includes("event:update");
  const canDelete = !!event && perms.includes("event:delete");
  const initial = event ? toInputs(event.startsAt) : { date: toInputs(day.toISOString()).date, time: "09:00" };

  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // le lead actuel reste choisissable même s'il n'est plus dans la liste chargée
  const options = [{ value: "", label: "Aucun lead" }, ...leads.map((l) => ({ value: l.id, label: l.name }))];
  if (event?.leadId && !leads.some((l) => l.id === event.leadId)) options.push({ value: event.leadId, label: event.leadName ?? "Lead" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const startsAt = fromInputs(String(f.get("date")), String(f.get("time")));
    if (!startsAt) return setNotice("Date ou heure invalide.");
    setSaving(true);
    setNotice(null);
    try {
      const body = {
        title: String(f.get("title") ?? "").trim(),
        kind: String(f.get("kind")),
        startsAt: startsAt.toISOString(),
        notes: String(f.get("notes") ?? "").trim(),
        leadId: String(f.get("leadId")) || null,
      };
      const saved = event
        ? await api<CalEvent>(`/events/${event.id}`, { method: "PATCH", body, companyId })
        : await api<CalEvent>("/events", { body, companyId });
      onSaved(saved);
    } catch (err) {
      setNotice(describeError(err));
      setSaving(false);
    }
  }

  async function remove() {
    if (!event) return;
    setSaving(true);
    try {
      await api(`/events/${event.id}`, { method: "DELETE", companyId });
      onSaved({ ...event, id: "" }); // l'appelant recharge : un id vide signale la suppression
    } catch (err) {
      setNotice(describeError(err));
      setConfirmDelete(false);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={event ? "Rendez-vous" : "Nouveau rendez-vous"}
      description={readOnly ? "Lecture seule" : "Visite, appel ou relance"}
      onClose={onClose}
      width="max-w-[520px]"
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}
        <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <Field label="Titre" name="title" required maxLength={120} autoFocus={!event} defaultValue={event?.title} placeholder="Visite chez Pharmacie Étoile" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Type" name="kind" defaultValue={event?.kind ?? "visit"} options={EVENT_KINDS.map((k) => ({ value: k, label: EVENT_KIND_LABEL[k] }))} />
            <Field label="Date" name="date" type="date" required defaultValue={initial.date} />
            <Field label="Heure" name="time" type="time" required defaultValue={initial.time} />
          </div>
          <Select label="Lead concerné" name="leadId" defaultValue={event?.leadId ?? ""} options={options} />
          <TextArea label="Notes" name="notes" maxLength={1000} defaultValue={event?.notes} placeholder="Apporter la maquette, demander le gérant…" />
        </fieldset>

        {confirmDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-field p-3">
            <p className="text-small font-medium">Supprimer ce rendez-vous ?</p>
            <div className="flex gap-2">
              <Button type="button" onClick={() => setConfirmDelete(false)} className="h-9 w-auto">
                Annuler
              </Button>
              <Button type="button" variant="secondary" loading={saving} onClick={remove} className="h-9 w-auto">
                Supprimer
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {canDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-small font-medium text-muted underline decoration-dotted decoration-2 underline-offset-4 hover:text-ink"
              >
                Supprimer ce rendez-vous
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose} className="sm:w-auto">
                {readOnly ? "Fermer" : "Annuler"}
              </Button>
              {!readOnly && (
                <Button type="submit" loading={saving} className="sm:w-auto">
                  {event ? "Enregistrer" : "Ajouter"}
                </Button>
              )}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

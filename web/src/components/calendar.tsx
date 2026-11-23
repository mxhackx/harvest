"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, EVENT_KIND_LABEL, api, errorMessage, type CalEvent, type EventKind } from "@/lib/api";
import { WEEKDAYS, addMonths, dayKey, eventsByDay, formatDayLong, formatMonth, formatTime, gridRange, monthGrid, sameDay, startOfDay, startOfMonth } from "@/lib/calendar";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { EventModal } from "./event-modal";
import { ChevronIcon, PencilIcon, PlusIcon } from "./icons";
import { Button, Notice, Panel } from "./ui";

// Un type de rendez-vous = une couleur ; un rendez-vous fait = point creux.
const KIND_COLOR: Record<EventKind, string> = { visit: "#0868c9", call: "#07625a", followup: "#14222e", other: "#8a99a6" };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Calendar() {
  const { me, companyId } = useSession();
  const { leads } = useLeads();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const canCreate = perms.includes("event:create");
  const canUpdate = perms.includes("event:update");

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalEvent | "new" | null>(null);

  const days = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => eventsByDay(events), [events]);

  const load = useCallback(() => {
    const { from, to } = gridRange(month);
    return api<CalEvent[]>(`/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, { companyId })
      .then((list) => {
        setEvents(list);
        setLoaded(true);
      })
      .catch((e) => setNotice(errorMessage(e instanceof ApiError ? e.code : null)));
  }, [month, companyId]);

  useEffect(() => {
    load();
    // comme pour les leads : on suit les changements faits ailleurs (autre appareil, autre membre)
    const refresh = () => document.visibilityState === "visible" && load();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  const today = new Date();
  const dayEvents = byDay.get(dayKey(selected)) ?? [];

  const goTo = (d: Date) => {
    setSelected(startOfDay(d));
    setMonth(startOfMonth(d));
  };

  async function toggleDone(e: CalEvent) {
    // affichage immédiat, corrigé par le rechargement si le serveur refuse
    setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, done: !x.done } : x)));
    try {
      await api(`/events/${e.id}`, { method: "PATCH", body: { done: !e.done }, companyId });
    } catch (err) {
      setNotice(errorMessage(err instanceof ApiError ? err.code : null));
    } finally {
      load();
    }
  }

  const nav = "flex size-9 items-center justify-center rounded-full border border-frame hover:bg-field";

  return (
    <Panel
      title="Agenda"
      description="Visites, appels et relances"
      action={
        canCreate ? (
          <Button onClick={() => setEditing("new")} className="h-9 w-auto">
            <PlusIcon size={16} /> Ajouter un rendez-vous
          </Button>
        ) : undefined
      }
    >
      {notice && (
        <div className="mb-4">
          <Notice onClose={() => setNotice(null)}>{notice}</Notice>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mois précédent" className={nav}>
              <span className="rotate-90">
                <ChevronIcon size={16} />
              </span>
            </button>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mois suivant" className={nav}>
              <span className="-rotate-90">
                <ChevronIcon size={16} />
              </span>
            </button>
            <h3 className="mx-2 text-title font-semibold" aria-live="polite">
              {capitalize(formatMonth(month))}
            </h3>
            <button type="button" onClick={() => goTo(today)} className="ml-auto h-9 rounded-full border border-frame px-3 text-small font-medium hover:bg-field">
              Aujourd&apos;hui
            </button>
          </div>

          <div role="grid" aria-label={`Calendrier ${formatMonth(month)}`} className="grid grid-cols-7 border-l border-t border-rule">
            {WEEKDAYS.map((w) => (
              <div key={w} role="columnheader" className="border-b border-r border-rule bg-field px-2 py-1 text-center text-small text-muted">
                {w}
              </div>
            ))}
            {days.map((d) => {
              const list = byDay.get(dayKey(d)) ?? [];
              const inMonth = d.getMonth() === month.getMonth();
              const isSel = sameDay(d, selected);
              const isToday = sameDay(d, today);
              return (
                <button
                  key={dayKey(d)}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  aria-label={`${formatDayLong(d)}${list.length ? `, ${list.length} rendez-vous` : ""}`}
                  data-day={dayKey(d)}
                  onClick={() => {
                    setSelected(startOfDay(d));
                    if (!inMonth) setMonth(startOfMonth(d));
                  }}
                  className={`flex min-h-[64px] flex-col items-start gap-1 border-b border-r border-rule p-1.5 text-left sm:min-h-[112px] ${
                    isSel ? "bg-accent-soft" : "hover:bg-field"
                  } ${inMonth ? "" : "text-muted"}`}
                >
                  <span
                    className={`flex size-6 items-center justify-center rounded-full font-mono text-small ${
                      isToday ? "bg-accent font-semibold text-white" : ""
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {list.length > 0 && (
                    <span className="flex w-full min-w-0 flex-col gap-0.5" aria-hidden>
                      {/* sur petit écran : points seulement ; dès sm : heure et titre */}
                      <span className="flex flex-wrap gap-1 sm:hidden">
                        {list.slice(0, 4).map((e) => (
                          <span key={e.id} className="size-2 rounded-full" style={{ background: KIND_COLOR[e.kind] }} />
                        ))}
                      </span>
                      {list.slice(0, 3).map((e) => (
                        <span key={e.id} className={`hidden min-w-0 items-center gap-1 truncate text-[12px] leading-tight sm:flex ${e.done ? "text-muted line-through" : ""}`}>
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[e.kind] }} />
                          <span className="font-mono">{formatTime(e.startsAt)}</span>
                          <span className="truncate">{e.title}</span>
                        </span>
                      ))}
                      {list.length > 3 && <span className="hidden font-mono text-[11px] sm:block">+{list.length - 3} autres</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small text-muted">
            {(Object.keys(KIND_COLOR) as EventKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
                {EVENT_KIND_LABEL[k]}
              </span>
            ))}
            <span>Point creux : fait</span>
          </p>
        </div>

        <section aria-label={`Rendez-vous du ${formatDayLong(selected)}`} className="flex flex-col gap-3">
          <h3 className="text-title font-semibold">{capitalize(formatDayLong(selected))}</h3>
          {!loaded ? (
            <p className="text-small text-muted">Chargement…</p>
          ) : dayEvents.length === 0 ? (
            <p className="text-small text-muted">Rien de prévu ce jour.</p>
          ) : (
            <ul className="flex flex-col">
              {dayEvents.map((e, i) => (
                <li key={e.id} className={`flex items-start gap-3 py-2 ${i > 0 ? "border-t border-rule" : ""}`}>
                  <input
                    type="checkbox"
                    checked={e.done}
                    disabled={!canUpdate}
                    onChange={() => toggleDone(e)}
                    aria-label={`Marquer « ${e.title} » comme fait`}
                    className="mt-1 size-4 shrink-0 accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-body font-medium ${e.done ? "text-muted line-through" : ""}`}>
                      <span className="mr-2 font-mono text-small text-muted">{formatTime(e.startsAt)}</span>
                      {e.title}
                    </p>
                    <p className="flex items-center gap-1.5 text-small text-muted">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: KIND_COLOR[e.kind] }} />
                      {EVENT_KIND_LABEL[e.kind]}
                      {e.leadName && <span className="truncate"> · {e.leadName}</span>}
                    </p>
                    {e.notes && <p className="mt-1 text-small">{e.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(e)}
                    aria-label={`Modifier ${e.title}`}
                    title="Modifier"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink"
                  >
                    <PencilIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {editing && (
        <EventModal
          event={editing === "new" ? undefined : editing}
          day={selected}
          leads={leads ?? []}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            if (saved.id) goTo(new Date(saved.startsAt)); // on montre le jour du rendez-vous enregistré
            setNotice(saved.id ? (editing === "new" ? "Rendez-vous ajouté." : "Rendez-vous mis à jour.") : "Rendez-vous supprimé.");
            load();
          }}
        />
      )}
    </Panel>
  );
}

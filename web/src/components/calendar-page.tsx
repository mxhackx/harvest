"use client";

import { useSession } from "@/lib/session";
import { Calendar } from "./calendar";

export function CalendarPage() {
  const { me } = useSession();
  const canSee = me.memberships[0].permissions.some((p) => p.permission === "event:read");
  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h1 className="font-serif text-title font-semibold">Calendrier</h1>
        <p className="text-small text-muted">Planifiez vos visites, appels et relances.</p>
      </div>
      {canSee ? (
        <Calendar />
      ) : (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Votre rôle n&apos;a pas accès au calendrier.</p>
      )}
    </div>
  );
}

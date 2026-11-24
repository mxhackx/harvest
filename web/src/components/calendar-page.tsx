"use client";

import { useState } from "react";
import { describeError, downloadFrom } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Calendar } from "./calendar";
import { Button, Notice } from "./ui";

export function CalendarPage() {
  const { me, companyId } = useSession();
  const [error, setError] = useState<string | null>(null);
  const canSee = me.memberships[0].permissions.some((p) => p.permission === "event:read");
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Calendrier</h1>
          <p className="text-small text-muted">Planifiez vos visites, appels et relances.</p>
        </div>
        {canSee && (
          <Button variant="secondary" className="h-9 w-auto" onClick={() => downloadFrom("/events/export.ics", companyId, "hivation.ics").catch((e) => setError(describeError(e)))}>
            Exporter (.ics)
          </Button>
        )}
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {canSee ? (
        <Calendar />
      ) : (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Votre rôle n&apos;a pas accès au calendrier.</p>
      )}
    </div>
  );
}

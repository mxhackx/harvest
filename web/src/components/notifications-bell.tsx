"use client";

import { ROUTES } from "@/lib/routes";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/activity";
import { useSession } from "@/lib/session";
import type { Notification } from "@/lib/tasks";
import { Menu } from "./ui";

type Inbox = { items: Notification[]; unread: number };
const REFRESH_MS = 60_000;

/**
 * Cloche du haut de page : notifications d'attribution + nombre de tâches en retard (calculé à la volée,
 * donc toujours juste sans tâche de fond).
 */
export function NotificationsBell() {
  const { me, companyId } = useSession();
  const canTasks = me.memberships[0].permissions.some((p) => p.permission === "task:read");
  const [inbox, setInbox] = useState<Inbox>({ items: [], unread: 0 });
  const [overdue, setOverdue] = useState(0);

  const load = useCallback(() => {
    api<Inbox>("/notifications", { companyId }).then(setInbox).catch(() => {});
    if (canTasks) api<unknown[]>("/tasks?status=overdue", { companyId }).then((t) => setOverdue(t.length)).catch(() => {});
  }, [companyId, canTasks]);

  useEffect(() => {
    load();
    const visible = () => document.visibilityState === "visible" && load();
    const timer = setInterval(visible, REFRESH_MS);
    window.addEventListener("focus", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", visible);
    };
  }, [load]);

  const badge = inbox.unread + overdue;
  const label = badge > 0 ? `Notifications, ${badge} à voir` : "Notifications";

  return (
    <Menu
      align="right"
      trigger={({ toggle, open }) => (
        <button type="button" onClick={toggle} aria-label={label} aria-expanded={open} className="relative flex size-9 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
            <path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" />
          </svg>
          {badge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fail px-1 text-[11px] font-bold leading-none text-white">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="w-[320px] max-w-[calc(100vw-32px)]">
          {overdue > 0 && (
            <Link href={ROUTES.tasks} onClick={close} className="block border-b border-rule px-3 py-2 text-small font-medium text-fail hover:bg-field">
              {overdue === 1 ? "1 tâche en retard" : `${overdue} tâches en retard`}
            </Link>
          )}
          {inbox.items.length === 0 ? (
            <p className="px-3 py-3 text-small text-muted">Aucune notification.</p>
          ) : (
            <>
              <ul className="max-h-[360px] overflow-y-auto">
                {inbox.items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.leadId ? ROUTES.lead(n.leadId) : ROUTES.tasks}
                      onClick={() => {
                        close();
                        api("/notifications/read", { method: "POST", body: { ids: [n.id] }, companyId }).then(load).catch(() => {});
                      }}
                      className={`block px-3 py-2 hover:bg-field ${n.readAt ? "text-muted" : ""}`}
                    >
                      <span className="block text-small">{n.title}</span>
                      <span className="block text-small text-muted">{relativeTime(n.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {inbox.unread > 0 && (
                <button type="button" onClick={() => api("/notifications/read", { method: "POST", body: {}, companyId }).then(load).catch(() => {})} className="w-full border-t border-rule px-3 py-2 text-left text-small font-medium text-accent-press hover:bg-field">
                  Tout marquer comme lu
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Menu>
  );
}

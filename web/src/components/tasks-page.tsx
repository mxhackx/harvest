"use client";

import { useState } from "react";
import { TaskList } from "./task-list";

/** Page Tâches : ce qu'il y a à faire (groupé par urgence) et ce qui est terminé. */
export function TasksPage() {
  const [tab, setTab] = useState<"open" | "done">("open");
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-title font-semibold">Tâches</h1>
      <section className="overflow-hidden rounded-card border border-border bg-card">
        <div role="tablist" aria-label="Tâches" className="flex gap-1 border-b border-rule px-3 pt-2">
          {(
            [
              ["open", "À faire"],
              ["done", "Terminées"],
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
          <TaskList key={tab} filter={tab} allowCreate={tab === "open"} />
        </div>
      </section>
    </div>
  );
}

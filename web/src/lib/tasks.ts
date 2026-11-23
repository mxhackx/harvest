export type Task = {
  id: string;
  title: string;
  ownerId: string;
  assigneeName: string;
  leadId: string | null;
  leadName: string | null;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
};

export type Notification = {
  id: string;
  kind: string;
  title: string;
  leadId: string | null;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type TaskState = "done" | "overdue" | "today" | "upcoming" | "none";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Où en est une tâche : terminée, en retard (échéance passée), pour aujourd'hui, à venir, ou sans échéance. */
export function taskState(t: Pick<Task, "dueAt" | "doneAt">, now: Date = new Date()): TaskState {
  if (t.doneAt) return "done";
  if (!t.dueAt) return "none";
  const due = new Date(t.dueAt);
  if (due < now) return "overdue";
  return startOfDay(due).getTime() === startOfDay(now).getTime() ? "today" : "upcoming";
}

/** Échéance lisible : « aujourd'hui 14:00 », « demain », « 3 j de retard »… */
export function dueLabel(t: Pick<Task, "dueAt" | "doneAt">, now: Date = new Date()): string {
  if (!t.dueAt) return "Sans échéance";
  const due = new Date(t.dueAt);
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const time = due.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (!t.doneAt && due < now) {
    if (days === 0) return `en retard · aujourd'hui ${time}`;
    return `en retard de ${-days} j`;
  }
  if (days === 0) return `aujourd'hui ${time}`;
  if (days === 1) return `demain ${time}`;
  if (days === -1) return `hier ${time}`;
  return due.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + ` ${time}`;
}

export type TaskGroup = { key: "overdue" | "today" | "upcoming" | "none"; label: string; tasks: Task[] };

/** Regroupe les tâches ouvertes : retard, aujourd'hui, à venir, sans échéance (groupes vides omis). */
export function groupOpenTasks(tasks: Task[], now: Date = new Date()): TaskGroup[] {
  const groups: TaskGroup[] = [
    { key: "overdue", label: "En retard", tasks: [] },
    { key: "today", label: "Aujourd'hui", tasks: [] },
    { key: "upcoming", label: "À venir", tasks: [] },
    { key: "none", label: "Sans échéance", tasks: [] },
  ];
  for (const t of tasks) {
    const s = taskState(t, now);
    if (s === "done") continue;
    groups.find((g) => g.key === s)!.tasks.push(t);
  }
  return groups.filter((g) => g.tasks.length > 0);
}

/** `<input type="datetime-local">` (heure locale, sans fuseau) → ISO UTC pour l'API ; vide → null. */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

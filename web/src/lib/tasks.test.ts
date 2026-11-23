import { describe, expect, it } from "vitest";
import { dueLabel, groupOpenTasks, localInputToIso, taskState, type Task } from "./tasks";

const NOW = new Date(2026, 5, 15, 14, 0);
const at = (d: number, h = 10) => new Date(2026, 5, 15 + d, h, 0).toISOString();
const t = (over: Partial<Task>): Task => ({ id: "1", title: "T", ownerId: "u", assigneeName: "A", leadId: null, leadName: null, dueAt: null, doneAt: null, createdAt: at(-5), ...over });

describe("taskState", () => {
  it("terminée, sans échéance, en retard, aujourd'hui, à venir", () => {
    expect(taskState(t({ doneAt: at(0) }), NOW)).toBe("done");
    expect(taskState(t({ doneAt: at(0), dueAt: at(-3) }), NOW)).toBe("done"); // terminée ≠ en retard
    expect(taskState(t({}), NOW)).toBe("none");
    expect(taskState(t({ dueAt: at(-1) }), NOW)).toBe("overdue");
    expect(taskState(t({ dueAt: at(0, 9) }), NOW)).toBe("overdue"); // aujourd'hui mais déjà passée
    expect(taskState(t({ dueAt: at(0, 18) }), NOW)).toBe("today");
    expect(taskState(t({ dueAt: at(2) }), NOW)).toBe("upcoming");
  });
});

describe("dueLabel", () => {
  it("décrit l'échéance", () => {
    expect(dueLabel(t({}), NOW)).toBe("Sans échéance");
    expect(dueLabel(t({ dueAt: at(0, 18) }), NOW)).toBe("aujourd'hui 18:00");
    expect(dueLabel(t({ dueAt: at(1, 9) }), NOW)).toBe("demain 09:00");
    expect(dueLabel(t({ dueAt: at(-3) }), NOW)).toBe("en retard de 3 j");
    expect(dueLabel(t({ dueAt: at(0, 9) }), NOW)).toBe("en retard · aujourd'hui 09:00");
    expect(dueLabel(t({ dueAt: at(-1), doneAt: at(0) }), NOW)).toBe("hier 10:00"); // terminée : plus « en retard »
  });
});

describe("groupOpenTasks", () => {
  it("range les tâches ouvertes par urgence et ignore les terminées", () => {
    const groups = groupOpenTasks(
      [t({ id: "a", dueAt: at(-2) }), t({ id: "b", dueAt: at(0, 20) }), t({ id: "c" }), t({ id: "d", dueAt: at(4) }), t({ id: "e", doneAt: at(0) })],
      NOW,
    );
    expect(groups.map((g) => [g.key, g.tasks.map((x) => x.id)])).toEqual([
      ["overdue", ["a"]],
      ["today", ["b"]],
      ["upcoming", ["d"]],
      ["none", ["c"]],
    ]);
    expect(groupOpenTasks([], NOW)).toEqual([]);
  });
});

describe("localInputToIso", () => {
  it("convertit la saisie locale et accepte le vide", () => {
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("n'importe quoi")).toBeNull();
    expect(localInputToIso("2026-06-15T14:30")).toBe(new Date(2026, 5, 15, 14, 30).toISOString());
  });
});

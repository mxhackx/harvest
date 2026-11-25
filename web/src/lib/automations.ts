export type Automation = { id: string; name: string; kind: "assign" | "task" | "email"; params: Record<string, unknown>; active: boolean; done: number };

export const KIND_LABEL: Record<Automation["kind"], string> = { assign: "Attribuer les nouveaux leads", task: "Relancer par une tâche", email: "Relancer par e-mail" };

/** Phrase qui dit ce que fait une règle (affichée dans la liste). */
export function describeRule(a: Pick<Automation, "kind" | "params">): string {
  const p = a.params as { userIds?: string[]; title?: string; afterDays?: number; subject?: string };
  if (a.kind === "assign") return `Chaque nouveau lead est confié à tour de rôle à ${p.userIds?.length ?? 0} personne${(p.userIds?.length ?? 0) > 1 ? "s" : ""}.`;
  const days = `${p.afterDays} jour${(p.afterDays ?? 0) > 1 ? "s" : ""}`;
  if (a.kind === "task") return `${days} après sa création, si rien ne s'est passé : tâche « ${p.title} ».`;
  return `${days} après sa création, si rien ne s'est passé : e-mail « ${p.subject} » au contact principal.`;
}

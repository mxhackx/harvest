/** Éditeur de workflows : types, blocs disponibles et règles locales. L'API (workflows/graph.ts) reste juge à l'enregistrement. */
export type NodeType = "start" | "agent" | "task" | "email" | "condition" | "approval";
export type StartInput = { name: string; type: "string" | "number" | "boolean" | "object" | "array"; description: string; value: string };
export type Config = Record<string, unknown>;
export type WorkflowNode = { id: string; type: NodeType; label: string; position: { x: number; y: number }; disabled: boolean; locked: boolean; config: Config };
export type Edge = { source: string; target: string };
export type Graph = { nodes: WorkflowNode[]; edges: Edge[] };
export type WorkflowSummary = { id: string; name: string; updatedAt: string };
export type Workflow = WorkflowSummary & { graph: Graph };

export const MAX_NODES = 30;

export const TRIGGERS = { manual: "Lancement manuel", lead_created: "Lead créé", lead_won: "Lead gagné", schedule: "Horaire planifié" };
export const INPUT_TYPES: Record<StartInput["type"], string> = { string: "Texte", number: "Nombre", boolean: "Oui / non", object: "Objet", array: "Liste" };
export const OPERATORS = { equals: "est égal à", not_equals: "est différent de", contains: "contient", greater: "est supérieur à", less: "est inférieur à", filled: "est rempli" };
export const AUTONOMY = ["Suggérer", "Agir avec validation", "Agir seul sous seuil", "Agir seul"];

/** Actions d'agent : libellé, niveau d'autonomie initial et maximal (mêmes plafonds que l'API). */
export const AGENT_ACTIONS = {
  qualifier_lead: { label: "Qualifier un lead", initial: 2, max: 4 },
  fusionner_doublons: { label: "Fusionner des doublons", initial: 2, max: 2 },
  envoyer_message: { label: "Envoyer un message", initial: 1, max: 2 },
  planifier_tournee: { label: "Planifier une tournée", initial: 1, max: 4 },
  planifier_relance: { label: "Planifier une relance", initial: 2, max: 4 },
  proposer_action: { label: "Proposer une action", initial: 1, max: 4 },
  mettre_a_jour_fiche: { label: "Mettre à jour une fiche", initial: 2, max: 4 },
};
export type AgentAction = keyof typeof AGENT_ACTIONS;

export const BLOCKS: Record<NodeType, { label: string; hint: string; token: string; config: () => Config }> = {
  start: { label: "Start", hint: "Ce qui déclenche le workflow", token: "--color-wave-closed", config: () => ({ trigger: "manual", inputs: [] }) },
  agent: { label: "Agent", hint: "Une action confiée à un agent IA", token: "--color-wave-planned", config: () => ({ action: "qualifier_lead", instruction: "", autonomy: 2 }) },
  task: { label: "Tâche", hint: "Créer une tâche pour l'équipe", token: "--color-wave-active", config: () => ({ title: "", afterDays: 0 }) },
  email: { label: "E-mail", hint: "Écrire au contact principal", token: "--color-wave-active", config: () => ({ subject: "", body: "" }) },
  condition: { label: "Condition", hint: "La chaîne s'arrête si c'est faux", token: "--color-wave-overdue", config: () => ({ field: "", operator: "equals", value: "" }) },
  approval: { label: "Validation", hint: "Attendre l'accord d'une personne", token: "--color-neutral", config: () => ({ message: "", timeoutHours: 24 }) },
};

/** Une chaîne linéaire : un seul bloc avant et un seul après, rien avant Start, pas de boucle. */
export function canConnect(g: Graph, source: string, target: string): boolean {
  if (source === target || g.nodes.find((n) => n.id === target)?.type === "start") return false;
  if (g.edges.some((e) => e.source === source || e.target === target)) return false;
  for (let at: string | undefined = target; at; at = g.edges.find((e) => e.source === at)?.target) if (at === source) return false;
  return true;
}

/** Les blocs reliés à Start, dans l'ordre d'exécution. */
export function chain(g: Graph): WorkflowNode[] {
  const out: WorkflowNode[] = [];
  let at = g.nodes.find((n) => n.type === "start");
  while (at && !out.includes(at)) {
    out.push(at);
    const next = g.edges.find((e) => e.source === at!.id)?.target;
    at = g.nodes.find((n) => n.id === next);
  }
  return out;
}

/** Ajoute un bloc à droite et le relie au bout de la chaîne ; `position` (glisser-déposer) le pose librement, sans lien. */
export function addNode(g: Graph, type: NodeType, id: string, position?: { x: number; y: number }): Graph {
  if (type === "start" || g.nodes.length >= MAX_NODES) return g;
  const tail = chain(g).at(-1);
  const same = g.nodes.filter((n) => n.type === type).length;
  const node: WorkflowNode = {
    id,
    type,
    label: `${BLOCKS[type].label} ${same + 1}`,
    position: position ?? { x: (tail?.position.x ?? 0) + 320, y: tail?.position.y ?? 0 },
    disabled: false,
    locked: false,
    config: BLOCKS[type].config(),
  };
  return { nodes: [...g.nodes, node], edges: !position && tail ? [...g.edges, { source: tail.id, target: id }] : g.edges };
}

/** Retire un bloc et recoud la chaîne autour de lui. Start et les blocs verrouillés restent. */
export function removeNode(g: Graph, id: string): Graph {
  const node = g.nodes.find((n) => n.id === id);
  if (!node || node.type === "start" || node.locked) return g;
  const before = g.edges.find((e) => e.target === id)?.source;
  const after = g.edges.find((e) => e.source === id)?.target;
  const edges = g.edges.filter((e) => e.source !== id && e.target !== id);
  return { nodes: g.nodes.filter((n) => n.id !== id), edges: before && after ? [...edges, { source: before, target: after }] : edges };
}

const REQUIRED: Partial<Record<NodeType, [string, string][]>> = {
  agent: [["instruction", "consigne"]],
  task: [["title", "titre"]],
  email: [["subject", "objet"], ["body", "message"]],
  condition: [["field", "champ"]],
};

export type CheckLine = { ok: boolean; nodeId?: string; text: string };

/** Contrôle d'un workflow, ligne par ligne comme le journal des contrôleurs du cahier des charges (§11.4). */
export function check(g: Graph): CheckLine[] {
  const linked = chain(g);
  const lines: CheckLine[] = [];
  if (linked.length < 2) lines.push({ ok: false, text: "Aucune étape n'est reliée à Start." });
  for (const n of [...linked, ...g.nodes.filter((x) => !linked.includes(x))]) {
    const problems: string[] = [];
    if (!linked.includes(n)) problems.push("pas relié à la chaîne");
    for (const [key, name] of REQUIRED[n.type] ?? []) if (!String(n.config[key] ?? "").trim()) problems.push(`${name} manquant`);
    if (n.type === "condition" && n.config.operator !== "filled" && !String(n.config.value ?? "").trim()) problems.push("valeur manquante");
    if (n.type === "start" && (n.config.inputs as StartInput[]).some((i) => !i.name.trim())) problems.push("une entrée sans nom");
    lines.push({ ok: problems.length === 0, nodeId: n.id, text: `${n.label} : ${problems.join(", ") || (n.disabled ? "désactivé, sera ignoré" : "prêt")}` });
  }
  return lines;
}

/** Résumé d'un bloc, affiché sur sa carte. */
export function summary(n: WorkflowNode): string {
  const c = n.config as Record<string, string>;
  if (n.type === "start") return TRIGGERS[c.trigger as keyof typeof TRIGGERS];
  if (n.type === "agent") return AGENT_ACTIONS[c.action as AgentAction].label;
  if (n.type === "task") return c.title || "Titre à écrire";
  if (n.type === "email") return c.subject || "Objet à écrire";
  if (n.type === "condition") return c.field ? `${c.field} ${OPERATORS[c.operator as keyof typeof OPERATORS]} ${c.operator === "filled" ? "" : c.value}` : "Condition à définir";
  return c.message || "Accord d'une personne";
}

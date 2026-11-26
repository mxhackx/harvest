import { z } from "zod";

/**
 * Définition d'un workflow (cahier des charges §12) : un déclencheur puis des étapes en chaîne LINÉAIRE.
 * Un brouillon peut être incomplet (bloc non relié, champ vide) ; il ne peut jamais être incohérent
 * (branche, boucle, deux déclencheurs, autonomie au-delà du plafond de l'action).
 */
export const MAX_NODES = 30;

/** Actions d'agent (§6.3 et §12.3) et niveau d'autonomie maximal : 1 suggérer … 4 agir seul. */
export const AGENT_ACTIONS = {
  qualifier_lead: 4,
  fusionner_doublons: 2,
  envoyer_message: 2,
  planifier_tournee: 4,
  planifier_relance: 4,
  proposer_action: 4,
  mettre_a_jour_fiche: 4,
} as const;
type AgentAction = keyof typeof AGENT_ACTIONS;

const text = (max: number) => z.string().trim().max(max).default("");
const input = z.object({
  name: text(60),
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  description: text(200),
  value: text(500),
});

const configs = {
  start: z.object({ trigger: z.enum(["manual", "lead_created", "lead_won", "schedule"]), inputs: z.array(input).max(20).default([]) }),
  agent: z
    .object({ action: z.enum(Object.keys(AGENT_ACTIONS) as [AgentAction, ...AgentAction[]]), instruction: text(4000), autonomy: z.number().int().min(1).max(4) })
    .refine((c) => c.autonomy <= AGENT_ACTIONS[c.action], { message: "niveau d'autonomie trop élevé pour cette action", path: ["autonomy"] }),
  task: z.object({ title: text(120), afterDays: z.number().int().min(0).max(365) }),
  email: z.object({ subject: text(200), body: text(4000) }),
  condition: z.object({ field: text(60), operator: z.enum(["equals", "not_equals", "contains", "greater", "less", "filled"]), value: text(200) }),
  approval: z.object({ message: text(500), timeoutHours: z.number().int().min(1).max(720) }),
};

const base = {
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  label: z.string().trim().min(1).max(60),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  disabled: z.boolean().default(false),
  locked: z.boolean().default(false),
};
const node = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("start"), config: configs.start }),
  z.object({ ...base, type: z.literal("agent"), config: configs.agent }),
  z.object({ ...base, type: z.literal("task"), config: configs.task }),
  z.object({ ...base, type: z.literal("email"), config: configs.email }),
  z.object({ ...base, type: z.literal("condition"), config: configs.condition }),
  z.object({ ...base, type: z.literal("approval"), config: configs.approval }),
]);

export const graphSchema = z
  .object({
    nodes: z.array(node).min(1).max(MAX_NODES),
    edges: z.array(z.object({ source: z.string(), target: z.string() })).max(MAX_NODES),
  })
  .superRefine((g, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message, path: ["edges"] });
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    if (byId.size !== g.nodes.length) return fail("deux blocs ont le même identifiant");
    if (g.nodes.filter((n) => n.type === "start").length !== 1) return fail("il faut exactement un déclencheur");
    const next = new Map<string, string>();
    const targets = new Set<string>();
    for (const e of g.edges) {
      if (!byId.has(e.source) || !byId.has(e.target)) return fail("un lien vise un bloc inconnu");
      if (byId.get(e.target)!.type === "start") return fail("rien ne précède le déclencheur");
      if (next.has(e.source) || targets.has(e.target)) return fail("la chaîne est linéaire : un seul bloc avant et un seul après");
      next.set(e.source, e.target);
      targets.add(e.target);
    }
    for (const from of next.keys()) {
      const seen = new Set<string>();
      for (let at: string | undefined = from; at; at = next.get(at)) {
        if (seen.has(at)) return fail("la chaîne ne peut pas boucler");
        seen.add(at);
      }
    }
  });

export type Graph = z.infer<typeof graphSchema>;

export const emptyGraph = (): Graph => ({
  nodes: [{ id: "start", type: "start", label: "Start", position: { x: 0, y: 0 }, disabled: false, locked: false, config: { trigger: "manual", inputs: [] } }],
  edges: [],
});

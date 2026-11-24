export type Scope = "own" | "team" | "company";

/** Catalogue : ressource → actions. `scoped` = la portée own/team/company a un sens. */
export const CATALOG = {
  company: { actions: ["read", "update", "delete"], scoped: false },
  team: { actions: ["read", "create", "update", "delete"], scoped: false },
  member: { actions: ["read", "create", "update", "delete"], scoped: false },
  role: { actions: ["read", "create", "update", "delete"], scoped: false },
  lead: { actions: ["read", "create", "update", "delete", "assign", "export"], scoped: true },
  event: { actions: ["read", "create", "update", "delete"], scoped: true },
  // tout membre lit les étapes de son entreprise ; seules la création, la modification et la suppression sont des droits
  stage: { actions: ["create", "update", "delete"], scoped: false },
  // tout membre lit les modèles de messages de l'entreprise ; les gérer est un droit
  template: { actions: ["create", "update", "delete"], scoped: false },
  task: { actions: ["read", "create", "update", "delete", "assign"], scoped: true },
  verification: { actions: ["read", "create", "update"], scoped: true },
  workflow: { actions: ["read", "create", "update", "delete"], scoped: true },
  finance: { actions: ["read", "create", "update", "delete"], scoped: true },
  // tout membre lit les régions et les vagues ; les gérer est un droit
  wave: { actions: ["create", "update", "delete"], scoped: false },
  // automatisations : attribution automatique, relances (tâche ou e-mail) après la création d'un lead
  automation: { actions: ["read", "create", "update", "delete"], scoped: false },
  // webhooks : réservés au CEO (ils envoient des données de l'entreprise à une adresse externe)
  webhook: { actions: ["read", "create", "delete"], scoped: false },
  // tout membre lit les comptes (entreprises clientes) ; les gérer est un droit
  account: { actions: ["create", "update", "delete"], scoped: false },
  // tout membre lit les champs personnalisés ; les gérer est un droit
  field: { actions: ["create", "update", "delete"], scoped: false },
  // chacun voit ses propres objectifs ; fixer ceux de l'équipe est un droit
  objective: { actions: ["update"], scoped: false },
  // journal des actions de l'entreprise : réservé au CEO
  audit: { actions: ["read"], scoped: false },
} as const;

export type Resource = keyof typeof CATALOG;
export type Permission = `${Resource}:${string}`;

export const ALL_PERMISSIONS: string[] = Object.entries(CATALOG).flatMap(([r, d]) =>
  d.actions.map((a) => `${r}:${a}`),
);

export function isValidPermission(p: string): boolean {
  return ALL_PERMISSIONS.includes(p);
}
export function isScoped(p: string): boolean {
  return CATALOG[p.split(":")[0] as Resource]?.scoped ?? false;
}

export const SCOPE_RANK: Record<Scope, number> = { own: 0, team: 1, company: 2 };

export type Grant = { permission: string; scope: Scope };

const all = (scope: Scope = "company"): Grant[] =>
  ALL_PERMISSIONS.map((permission) => ({ permission, scope }));

const g = (spec: Record<string, Scope>): Grant[] =>
  Object.entries(spec).map(([permission, scope]) => ({ permission, scope }));

export type SystemRole = { key: string; name: string; description: string; grants: Grant[] };

export const SYSTEM_ROLES: SystemRole[] = [
  {
    key: "ceo",
    name: "CEO",
    description: "Contrôle total de l'entreprise.",
    grants: all(),
  },
  {
    key: "manager",
    name: "Manager",
    description: "Pilote l'équipe et les données. Ne modifie pas l'entreprise ni les rôles.",
    grants: all().filter(
      (x) =>
        !["company:update", "company:delete", "role:create", "role:update", "role:delete", "audit:read", "webhook:read", "webhook:create", "webhook:delete"].includes(
          x.permission,
        ),
    ),
  },
  {
    key: "prospecteur",
    name: "Prospecteur",
    description: "Saisit et suit ses propres leads sur le terrain.",
    grants: g({
      "lead:create": "company",
      "lead:read": "own",
      "lead:update": "own",
      "event:read": "own",
      "event:create": "own",
      "event:update": "own",
      "event:delete": "own",
      "task:read": "own",
      "task:create": "own",
      "task:update": "own",
      "task:delete": "own",
      "team:read": "company",
    }),
  },
  {
    key: "affilie",
    name: "Affilié",
    description: "Apporte des leads et suit uniquement les siens et ses commissions.",
    grants: g({
      "lead:create": "company",
      "lead:read": "own",
      "finance:read": "own",
    }),
  },
  {
    key: "worker",
    name: "Taffeur",
    description: "Travaille les dossiers de son équipe.",
    grants: g({
      "lead:read": "team",
      "lead:update": "team",
      "event:read": "own",
      "event:create": "own",
      "event:update": "own",
      "event:delete": "own",
      "task:read": "own",
      "task:create": "own",
      "task:update": "own",
      "task:delete": "own",
      "verification:read": "team",
      "verification:create": "team",
      "verification:update": "team",
      "workflow:read": "company",
      "team:read": "company",
    }),
  },
];

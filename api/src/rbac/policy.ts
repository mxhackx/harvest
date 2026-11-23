import { SCOPE_RANK, type Grant, type Scope } from "./permissions.js";

export type Subject = {
  userId: string;
  companyId: string;
  teamId: string | null;
  /** permission → portée la plus large obtenue en cumulant tous les rôles */
  grants: Map<string, Scope>;
};

export type ResourceAttrs = {
  companyId: string;
  ownerId?: string | null;
  teamId?: string | null;
};

/** Fusionne les droits de plusieurs rôles : la portée la plus large l'emporte. */
export function mergeGrants(lists: Grant[][]): Map<string, Scope> {
  const out = new Map<string, Scope>();
  for (const list of lists)
    for (const { permission, scope } of list) {
      const cur = out.get(permission);
      if (!cur || SCOPE_RANK[scope] > SCOPE_RANK[cur]) out.set(permission, scope);
    }
  return out;
}

/**
 * Décision ABAC. Sans `resource` : « a-t-on ce droit quelque part ? » (contrôle de route).
 * Avec `resource` : compare les attributs du sujet à ceux de la ressource.
 */
export function can(subject: Subject, permission: string, resource?: ResourceAttrs): boolean {
  const scope = subject.grants.get(permission);
  if (!scope) return false;
  if (!resource) return true;
  // Étanchéité entre entreprises : aucune portée ne la franchit.
  if (resource.companyId !== subject.companyId) return false;
  if (scope === "company") return true;
  const isOwner = !!resource.ownerId && resource.ownerId === subject.userId;
  if (scope === "own") return isOwner;
  // team : même équipe, ou propriétaire (own ⊂ team)
  return isOwner || (!!subject.teamId && resource.teamId === subject.teamId);
}

export type ListFilter =
  | { kind: "none" }
  | { kind: "company" }
  | { kind: "team"; teamId: string | null; userId: string }
  | { kind: "own"; userId: string };

/** Pour les requêtes de liste : quelle restriction appliquer dans le WHERE. */
export function listFilter(subject: Subject, permission: string): ListFilter {
  const scope = subject.grants.get(permission);
  if (!scope) return { kind: "none" };
  if (scope === "company") return { kind: "company" };
  if (scope === "team") return { kind: "team", teamId: subject.teamId, userId: subject.userId };
  return { kind: "own", userId: subject.userId };
}

/** Anti-escalade : on ne peut accorder que des droits qu'on détient au moins aussi largement. */
export function exceedsOwnRights(subject: Subject, grants: Grant[]): Grant[] {
  return grants.filter((x) => {
    const mine = subject.grants.get(x.permission);
    return !mine || SCOPE_RANK[x.scope] > SCOPE_RANK[mine];
  });
}

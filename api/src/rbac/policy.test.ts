import { describe, expect, it } from "vitest";
import { can, exceedsOwnRights, listFilter, mergeGrants, type Subject } from "./policy.js";
import { SYSTEM_ROLES } from "./permissions.js";

const roleGrants = (key: string) => SYSTEM_ROLES.find((r) => r.key === key)!.grants;
const subject = (key: string | string[], teamId: string | null = "t1"): Subject => ({
  userId: "u1",
  companyId: "c1",
  teamId,
  grants: mergeGrants([key].flat().map(roleGrants)),
});

describe("can()", () => {
  it("refuse sans droit", () => {
    expect(can(subject("affilie"), "lead:delete")).toBe(false);
  });
  it("own : seulement ses fiches", () => {
    const s = subject("prospecteur");
    expect(can(s, "lead:read", { companyId: "c1", ownerId: "u1" })).toBe(true);
    expect(can(s, "lead:read", { companyId: "c1", ownerId: "u2", teamId: "t1" })).toBe(false);
  });
  it("team : son équipe + ses fiches", () => {
    const s = subject("worker");
    expect(can(s, "lead:read", { companyId: "c1", ownerId: "u2", teamId: "t1" })).toBe(true);
    expect(can(s, "lead:read", { companyId: "c1", ownerId: "u2", teamId: "t2" })).toBe(false);
    expect(can(s, "lead:read", { companyId: "c1", ownerId: "u1", teamId: "t2" })).toBe(true);
  });
  it("team sans équipe : pas d'accès par équipe", () => {
    const s = subject("worker", null);
    expect(can(s, "lead:read", { companyId: "c1", ownerId: "u2", teamId: null })).toBe(false);
  });
  it("jamais d'accès à une autre entreprise, même CEO", () => {
    expect(can(subject("ceo"), "lead:read", { companyId: "c2", ownerId: "u1" })).toBe(false);
  });
  it("cumul de rôles : la portée la plus large gagne", () => {
    const s = subject(["prospecteur", "worker"]);
    expect(s.grants.get("lead:read")).toBe("team");
  });
});

describe("rôles système", () => {
  it("le manager ne gère pas les rôles ni l'entreprise", () => {
    const s = subject("manager");
    expect(can(s, "role:update")).toBe(false);
    expect(can(s, "company:delete")).toBe(false);
    expect(can(s, "lead:delete")).toBe(true);
  });
  it("le CEO a tout", () => {
    expect(can(subject("ceo"), "company:delete")).toBe(true);
  });
});

describe("listFilter / anti-escalade", () => {
  it("filtre de liste selon la portée", () => {
    expect(listFilter(subject("prospecteur"), "lead:read")).toEqual({ kind: "own", userId: "u1" });
    expect(listFilter(subject("affilie"), "task:read").kind).toBe("none");
  });
  it("interdit d'accorder plus que ce qu'on détient", () => {
    const s = subject("manager");
    const bad = exceedsOwnRights(s, [
      { permission: "role:update", scope: "company" },
      { permission: "lead:read", scope: "company" },
    ]);
    expect(bad.map((b) => b.permission)).toEqual(["role:update"]);
    expect(exceedsOwnRights(subject("worker"), [{ permission: "lead:read", scope: "company" }])).toHaveLength(1);
  });
});

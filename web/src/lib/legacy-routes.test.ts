import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { LEGACY, currentPath, legacyRedirects } from "./legacy-routes";

describe("currentPath", () => {
  it("réécrit les anciennes adresses françaises, sous-pages comprises", () => {
    expect(currentPath("/leads")).toBe("/dashboard/crm/leads");
    expect(currentPath("/dashboard/taches")).toBe("/dashboard/crm/tasks");
    expect(currentPath("/dashboard/crm/rapports")).toBe("/dashboard/crm/reports");
    expect(currentPath("/dashboard/leads/42")).toBe("/dashboard/crm/leads/42");
    expect(currentPath("/dashboard/equipe")).toBe("/dashboard/erp/team");
    expect(currentPath("/dashboard/calendrier")).toBe("/dashboard/calendar");
    expect(currentPath("/reinitialiser")).toBe("/reset-password");
    expect(currentPath("/docs/import/champs")).toBe("/docs/import/fields");
  });
  it("laisse intactes les adresses à jour et les autres", () => {
    for (const p of ["/dashboard/crm/tasks", "/dashboard/calendar", "/docs/team", "/dashboard/leadsX", "/templates/leads-modele.csv"]) expect(currentPath(p)).toBe(p);
  });
});

describe("LEGACY", () => {
  it("chaque adresse actuelle correspond à une vraie page ou à un module (pas de redirection vers le vide)", () => {
    for (const [, to] of LEGACY) {
      const dir = `src/app${to}`;
      expect(existsSync(`${dir}/page.tsx`) || existsSync(dir), to).toBe(true);
    }
  });
  it("génère une redirection permanente par ancienne adresse, qui garde la sous-page", () => {
    const r = legacyRedirects();
    expect(r).toHaveLength(LEGACY.length);
    expect(r[0]).toMatchObject({ permanent: true, source: "/dashboard/crm/taches/:rest*", destination: "/dashboard/crm/tasks/:rest*" });
  });
});

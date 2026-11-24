import { describe, expect, it } from "vitest";
import { ROUTES, currentPath } from "./routes";

describe("ROUTES", () => {
  it("chaque module a son préfixe (crm, erp) ; l'accueil et le calendrier restent sous /dashboard", () => {
    expect(ROUTES.leads).toBe("/dashboard/crm/leads");
    expect(ROUTES.lead("42")).toBe("/dashboard/crm/leads/42");
    for (const r of [ROUTES.contacts, ROUTES.tasks, ROUTES.templates, ROUTES.pipeline, ROUTES.reports]) expect(r.startsWith("/dashboard/crm/")).toBe(true);
    expect(ROUTES.calendar).toBe("/dashboard/calendrier");
    expect(ROUTES.team).toBe("/dashboard/erp/equipe");
  });
});

describe("currentPath", () => {
  it("réécrit les anciennes adresses, avec ou sans /dashboard, sous-pages comprises", () => {
    expect(currentPath("/leads")).toBe("/dashboard/crm/leads");
    expect(currentPath("/dashboard/taches")).toBe("/dashboard/crm/taches");
    expect(currentPath("/dashboard/leads/42")).toBe("/dashboard/crm/leads/42");
    expect(currentPath("/dashboard/equipe")).toBe("/dashboard/erp/equipe");
  });
  it("laisse intactes les adresses à jour et les autres pages", () => {
    expect(currentPath("/dashboard/crm/leads")).toBe("/dashboard/crm/leads");
    expect(currentPath("/dashboard/calendrier")).toBe("/dashboard/calendrier");
    expect(currentPath("/dashboard/leadsX")).toBe("/dashboard/leadsX");
  });
});

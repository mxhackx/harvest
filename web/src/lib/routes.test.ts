import { describe, expect, it } from "vitest";
import { ROUTES } from "./routes";

describe("ROUTES", () => {
  it("chaque module a son préfixe (crm, erp) ; l'accueil et le calendrier restent sous /dashboard", () => {
    expect(ROUTES.leads).toBe("/dashboard/crm/leads");
    expect(ROUTES.lead("42")).toBe("/dashboard/crm/leads/42");
    for (const r of [ROUTES.contacts, ROUTES.tasks, ROUTES.templates, ROUTES.pipeline, ROUTES.reports]) expect(r.startsWith("/dashboard/crm/")).toBe(true);
    expect(ROUTES.tasks).toBe("/dashboard/crm/tasks");
    expect(ROUTES.calendar).toBe("/dashboard/calendar");
    expect(ROUTES.team).toBe("/dashboard/erp/team");
  });
});

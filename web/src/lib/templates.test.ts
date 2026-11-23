import { describe, expect, it } from "vitest";
import { MINIMAL_CSV, SAMPLE_CSV } from "./lead-fields";
import { TEMPLATES, templateResponse, type TemplateName } from "./templates";

describe("modèles téléchargeables", () => {
  it("quatre modèles, avec un nom de fichier et un type cohérents", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(["leads-minimal.csv", "leads-minimal.json", "leads-modele.csv", "leads-modele.json"]);
    for (const [name, t] of Object.entries(TEMPLATES)) expect(t.type.startsWith(name.endsWith(".csv") ? "text/csv" : "application/json"), name).toBe(true);
  });
  it("les CSV commencent par un BOM (accents corrects dans Excel) ; les JSON sont valides", () => {
    expect(TEMPLATES["leads-modele.csv"].body).toBe("﻿" + SAMPLE_CSV);
    expect(TEMPLATES["leads-minimal.csv"].body).toBe("﻿" + MINIMAL_CSV);
    expect(() => JSON.parse(TEMPLATES["leads-modele.json"].body)).not.toThrow();
    expect(Array.isArray(JSON.parse(TEMPLATES["leads-minimal.json"].body))).toBe(true);
  });
  it("la réponse est un téléchargement", async () => {
    for (const name of Object.keys(TEMPLATES) as TemplateName[]) {
      const res = templateResponse(name);
      expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${name}"`);
      expect(res.headers.get("content-type")).toBe(TEMPLATES[name].type);
      expect((await res.text()).length).toBeGreaterThan(10);
    }
  });
});

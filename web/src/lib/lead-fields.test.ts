import { describe, expect, it } from "vitest";
// Vérification croisée : la documentation doit décrire exactement ce que l'import de l'API accepte.
import { IMPORT_FIELDS, cleanRow, normalizeHeader, parseImport } from "../../../api/src/leads/import";
import {
  EXAMPLE_FRENCH_JSON,
  EXAMPLE_SEMICOLON_CSV,
  EXAMPLE_WRAPPED_JSON,
  FIELD_DOCS,
  IGNORED_EXPORT_COLUMNS,
  MINIMAL_CSV,
  MINIMAL_JSON,
  SAMPLE_CSV,
  SAMPLE_JSON,
  SAMPLE_ROWS,
} from "./lead-fields";

function importAll(content: string) {
  const parsed = parseImport(content);
  const results = parsed.records.map(cleanRow);
  return { parsed, results, issues: results.flatMap((r) => r.issues), rows: results.flatMap((r) => (r.row ? [r.row] : [])) };
}

describe("description des champs (documentation)", () => {
  it("les clés sont uniques et seul « name » est obligatoire", () => {
    const keys = FIELD_DOCS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(FIELD_DOCS.filter((f) => f.required).map((f) => f.key)).toEqual(["name"]);
  });
  it("chaque champ a un libellé, un type, une description et un exemple", () => {
    for (const f of FIELD_DOCS) for (const part of [f.label, f.type, f.description, f.example]) expect(part.trim().length, f.key).toBeGreaterThan(0);
  });
  it("décrit exactement les champs que l'import de l'API comprend", () => {
    expect(FIELD_DOCS.map((f) => f.key).sort()).toEqual(Object.keys(IMPORT_FIELDS).sort());
  });
  it("chaque nom de colonne cité (clé ou alias) est réellement reconnu par l'import", () => {
    for (const f of FIELD_DOCS) {
      const accepted = IMPORT_FIELDS[f.key as keyof typeof IMPORT_FIELDS] as readonly string[];
      expect(accepted, `${f.key} (clé)`).toContain(normalizeHeader(f.key));
      for (const alias of f.aliases) expect(accepted, `${f.key} ← « ${alias} »`).toContain(normalizeHeader(alias));
    }
  });
  it("les colonnes d'export ignorées existent bien dans l'export", () => {
    expect(IGNORED_EXPORT_COLUMNS).toEqual(["id", "statusLabel", "locationSource", "owner", "createdAt", "updatedAt"]);
  });
});

describe("modèles et exemples de la documentation : tous s'importent sans erreur", () => {
  it("modèle CSV complet : 3 leads, aucune erreur, aucune colonne ignorée", () => {
    const r = importAll(SAMPLE_CSV);
    expect(r.parsed.records).toHaveLength(3);
    expect(r.issues).toEqual([]);
    expect(r.parsed.ignoredColumns).toEqual([]);
    expect(r.parsed.format).toBe("csv");
  });
  it("modèle JSON complet : 3 leads, aucune erreur", () => {
    const r = importAll(SAMPLE_JSON);
    expect(r.parsed.records).toHaveLength(3);
    expect(r.issues).toEqual([]);
    expect(r.parsed.ignoredColumns).toEqual([]);
    expect(r.parsed.format).toBe("json");
  });
  it("les modèles CSV et JSON décrivent les mêmes leads", () => {
    const csv = importAll(SAMPLE_CSV).rows.map((r) => r.data);
    const json = importAll(SAMPLE_JSON).rows.map((r) => r.data);
    expect(json).toEqual(csv);
  });
  it("le contenu des modèles est bien interprété (étapes françaises, visite, nombres)", () => {
    const rows = importAll(SAMPLE_CSV).rows;
    expect(rows.map((r) => r.data.status)).toEqual(["to_visit", "interested", "mockup_sent"]);
    expect(rows[0].data).toMatchObject({ lat: 6.3654, lng: 2.3912, estimatedValue: 150000, whatsapp: "+22997001122", website: "https://boulangerie-soleil.bj/" });
    expect(rows[1].data.visited).toBe(true);
    expect(rows[1].visitedAt?.toISOString()).toContain("2026-11-20");
    expect(rows[0].data.visited).toBeUndefined(); // « non » : pas visité
  });
  it("modèles minimaux", () => {
    expect(importAll(MINIMAL_CSV).rows.map((r) => r.data.name)).toEqual(["Pharmacie Étoile", "Salon Prestige"]);
    expect(importAll(MINIMAL_JSON).rows.map((r) => r.data.name)).toEqual(["Pharmacie Étoile", "Salon Prestige"]);
    expect(importAll(MINIMAL_CSV).issues).toEqual([]);
    expect(importAll(MINIMAL_JSON).issues).toEqual([]);
  });
  it("exemple en français avec point-virgule et guillemets doublés", () => {
    const r = importAll(EXAMPLE_SEMICOLON_CSV);
    expect(r.issues).toEqual([]);
    expect(r.rows.map((x) => x.data.name)).toEqual(["Pharmacie Étoile", 'Salon "Prestige", Akpakpa']);
    expect(r.rows[0].data).toMatchObject({ city: "Cotonou", phone: "+229 97 00 11 22", estimatedValue: 150000, status: "interested" });
    expect(r.parsed.ignoredColumns).toEqual([]);
  });
  it("exemple JSON avec une clé « leads »", () => {
    const r = importAll(EXAMPLE_WRAPPED_JSON);
    expect(r.issues).toEqual([]);
    expect(r.rows.map((x) => x.data.name)).toEqual(["Pharmacie Étoile", "Salon Prestige"]);
  });
  it("exemple JSON en français", () => {
    const r = importAll(EXAMPLE_FRENCH_JSON);
    expect(r.issues).toEqual([]);
    expect(r.rows[0].data).toMatchObject({ name: "Pharmacie Étoile", city: "Cotonou", status: "interested", estimatedValue: 150000 });
  });
  it("les exemples de chaque champ de la documentation sont eux-mêmes valides", () => {
    for (const f of FIELD_DOCS) {
      const r = cleanRow({ line: 2, data: { name: "Test", [f.key]: f.example, ...(f.key === "lat" ? { lng: "2.4" } : f.key === "lng" ? { lat: "6.3" } : {}) } });
      expect(r.issues, `${f.key} = ${f.example}`).toEqual([]);
    }
  });
  it("le jeu d'exemples reste cohérent", () => {
    expect(SAMPLE_ROWS).toHaveLength(3);
    expect(SAMPLE_ROWS.every((r) => r.name)).toBe(true);
  });
});

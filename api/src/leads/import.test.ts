import { describe, expect, it } from "vitest";
import { CsvError, detectDelimiter, parseCsv } from "./csv.js";
import { cleanRow, duplicateKey, ImportError, MAX_IMPORT_ROWS, normalizeHeader, parseImport } from "./import.js";

describe("parseCsv", () => {
  it("lit des champs simples et ignore les lignes vides", () => {
    const r = parseCsv("a,b,c\n1,2,3\n\n4,5,6\n");
    expect(r.map((x) => x.fields)).toEqual([["a", "b", "c"], ["1", "2", "3"], ["4", "5", "6"]]);
  });
  it("gère guillemets, séparateurs, guillemets doublés et sauts de ligne dans un champ", () => {
    const r = parseCsv('name,note\n"Chez ""Awa"", le meilleur","ligne1\nligne2"\nsuite,ok');
    expect(r[1].fields).toEqual(['Chez "Awa", le meilleur', "ligne1\nligne2"]);
    expect(r[2].fields).toEqual(["suite", "ok"]);
  });
  it("donne la vraie ligne de départ de chaque enregistrement, même après un champ multiligne", () => {
    const r = parseCsv('a,b\n"x\ny",1\nz,2');
    expect(r.map((x) => x.line)).toEqual([1, 2, 4]);
  });
  it("accepte CRLF, CR seul et le BOM UTF-8", () => {
    expect(parseCsv("﻿a;b\r\n1;2\r\n").map((x) => x.fields)).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a,b\r1,2").map((x) => x.fields)).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("devine le séparateur d'après l'en-tête, en ignorant ce qui est entre guillemets", () => {
    expect(detectDelimiter("a;b;c\n1,2,3")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter('"a,b";c;d')).toBe(";");
    expect(detectDelimiter("seule colonne")).toBe(",");
    expect(parseCsv("a;b\n1;2")[1].fields).toEqual(["1", "2"]);
  });
  it("garde les champs vides et un dernier champ vide", () => {
    expect(parseCsv("a,b,c\n1,,\n").map((x) => x.fields)[1]).toEqual(["1", "", ""]);
  });
  it("signale un guillemet jamais refermé avec sa ligne", () => {
    expect(() => parseCsv('a,b\n"oups,1')).toThrow(CsvError);
    expect(() => parseCsv('a,b\n"oups,1')).toThrow(/ligne 2/);
  });
});

describe("parseImport : colonnes", () => {
  it("reconnaît les noms français et anglais, sans tenir compte des accents ni de la casse", () => {
    const p = parseImport("Nom;Téléphone;Site Web;Adresse;Ville;Repère;Étape;Valeur estimée\nPharmacie;+229 97;a.bj;Rue 1;Cotonou;près du marché;Intéressé;5000");
    expect(p.records[0].data).toMatchObject({ name: "Pharmacie", phone: "+229 97", website: "a.bj", address: "Rue 1", city: "Cotonou", landmark: "près du marché", status: "Intéressé", estimatedValue: "5000" });
    expect(p.ignoredColumns).toEqual([]);
  });
  it("liste les colonnes inconnues mais pas celles d'un export Hivation", () => {
    const p = parseImport("id,name,statusLabel,owner,createdAt,couleur_preferee\n1,A,À visiter,Aris,2026-01-01,bleu");
    expect(p.ignoredColumns).toEqual(["couleur_preferee"]);
  });
  it("exige une colonne de nom", () => {
    expect(() => parseImport("secteur,ville\nx,y")).toThrow(/name/);
    try {
      parseImport("secteur,ville\nx,y");
    } catch (e) {
      expect((e as ImportError).code).toBe("no_name_column");
    }
  });
  it("normalise les en-têtes", () => {
    expect(normalizeHeader(" Lien Google-Maps ")).toBe("liengooglemaps");
    expect(normalizeHeader("Répère")).toBe("repere");
  });
});

describe("parseImport : JSON et limites", () => {
  it("accepte un tableau ou un objet { leads: [...] }", () => {
    expect(parseImport('[{"name":"A"},{"nom":"B"}]').records.map((r) => r.data.name)).toEqual(["A", "B"]);
    expect(parseImport('{"leads":[{"name":"A"}]}').records).toHaveLength(1);
    expect(parseImport('﻿ [{"name":"A"}]').format).toBe("json");
  });
  it("détecte le format tout seul, ou suit celui qu'on impose", () => {
    expect(parseImport("name\nA").format).toBe("csv");
    expect(parseImport("[{}]", "json").format).toBe("json");
  });
  it("refuse un JSON invalide ou qui n'est pas une liste", () => {
    expect(() => parseImport("[{name: A}]")).toThrow(/JSON invalide/);
    expect(() => parseImport('{"name":"A"}')).toThrow(/tableau/);
    expect(() => parseImport("[]")).toThrow(/aucun lead/);
  });
  it("marque les entrées qui ne sont pas des objets", () => {
    const p = parseImport('[{"name":"A"}, 42, null, ["x"]]');
    expect(p.records.map((r) => !!r.data.__invalid)).toEqual([false, true, true, true]);
  });
  it("ignore les clés inconnues d'un JSON et les liste", () => {
    expect(parseImport('[{"name":"A","bidule":1,"id":"x"}]').ignoredColumns).toEqual(["bidule"]);
  });
  it("refuse un fichier vide ou trop gros", () => {
    expect(() => parseImport("   ")).toThrow(/vide/);
    expect(() => parseImport("name\n")).toThrow(/au moins un lead/);
    const big = "name\n" + Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `L${i}`).join("\n");
    expect(() => parseImport(big)).toThrow(/limite/);
  });
});

const clean = (data: Record<string, unknown>) => cleanRow({ line: 2, data });

describe("cleanRow", () => {
  it("convertit les textes en types et normalise les liens", () => {
    const r = clean({ name: " Boulangerie ", lat: "6,3654", lng: "2.3912", estimatedValue: "150 000", status: "Maquette envoyée", visited: "oui", website: "a.bj", whatsapp: "+229 97 00 11 22" });
    expect(r.issues).toEqual([]);
    expect(r.row!.data).toMatchObject({ name: "Boulangerie", lat: 6.3654, lng: 2.3912, estimatedValue: 150000, status: "mockup_sent", visited: true, website: "https://a.bj/", whatsapp: "+22997001122" });
  });
  it("accepte aussi les codes d'étape et les nombres JSON", () => {
    const r = clean({ name: "A", status: "deposit_paid", lat: 6.3, lng: 2.4, estimatedValue: 1000, visited: true });
    expect(r.row!.data).toMatchObject({ status: "deposit_paid", lat: 6.3, estimatedValue: 1000, visited: true });
  });
  it("comprend les booléens courants", () => {
    for (const [v, expected] of [["Oui", true], ["non", false], ["TRUE", true], ["0", false], ["x", true], [true, true], [false, false]] as const) {
      const r = clean({ name: "A", visited: v });
      expect(r.issues).toEqual([]);
      expect(Boolean(r.row!.data.visited)).toBe(expected);
    }
    expect(clean({ name: "A", visited: "peut-être" }).issues[0]).toMatchObject({ field: "visited" });
  });
  it("lit la date de visite ; « non visité » l'emporte", () => {
    expect(clean({ name: "A", visitedAt: "2026-11-20" }).row!.visitedAt?.toISOString()).toContain("2026-11-20");
    expect(clean({ name: "A", visited: "non", visitedAt: "2026-11-20" }).row!.visitedAt).toBeNull();
    expect(clean({ name: "A", visitedAt: "hier" }).issues[0]).toMatchObject({ field: "visitedAt" });
  });
  it("signale chaque problème avec son champ et sa ligne", () => {
    expect(clean({ name: "A", status: "en pause" }).issues[0]).toMatchObject({ line: 2, field: "status" });
    expect(clean({ name: "A", lat: "6.3" }).issues[0]).toMatchObject({ field: "lat" });
    expect(clean({ name: "A", lat: "abc", lng: "2" }).issues[0]).toMatchObject({ field: "lat" });
    expect(clean({ name: "A", lat: "99", lng: "2" }).issues[0]).toMatchObject({ field: "lat", message: "latitude hors limites (−90 à 90)" });
    expect(clean({ name: "x".repeat(121) }).issues[0]).toMatchObject({ field: "name", message: "trop long (120 caractères au plus)" });
    expect(clean({ name: "A", estimatedValue: "12,5" }).issues[0]).toMatchObject({ field: "estimatedValue" });
    expect(clean({ name: "A", estimatedValue: "-5" }).issues[0]).toMatchObject({ field: "estimatedValue" });
    expect(clean({ name: "A", website: "javascript:alert(1)" }).issues[0]).toMatchObject({ field: "website" });
    expect(clean({ name: "A", googleMapsUrl: "https://evil.example/maps" }).issues[0]).toMatchObject({ field: "googleMapsUrl" });
    expect(clean({ name: "A", whatsapp: "pas un numéro" }).issues[0]).toMatchObject({ field: "whatsapp" });
  });
  it("le nom est obligatoire, avec un message clair", () => {
    for (const data of [{}, { name: "" }, { name: "   " }, { sector: "x" }]) {
      const r = clean(data);
      expect(r.row).toBeUndefined();
      expect(r.issues[0]).toMatchObject({ field: "name" });
    }
    expect(clean({ __invalid: true }).issues[0].message).toMatch(/objet JSON/);
  });
  it("traite les cellules vides comme absentes", () => {
    const r = clean({ name: "A", sector: "", lat: "", lng: "", estimatedValue: "", status: "", visited: "" });
    expect(r.issues).toEqual([]);
    expect(r.row!.data.status).toBeUndefined();
    expect(r.row!.data.lat).toBeUndefined();
  });
});

describe("duplicateKey", () => {
  it("ignore la casse, les espaces et la mise en forme du téléphone", () => {
    const a = duplicateKey({ name: " Pharmacie  Étoile ", phone: "+229 97-00-11-22", address: "Rue 12" });
    const b = duplicateKey({ name: "pharmacie étoile", phone: "22997001122", address: "rue  12" });
    expect(a).toBe(b);
  });
  it("accepte un lead sans téléphone ni adresse (colonnes absentes du fichier)", () => {
    expect(duplicateKey({ name: "A" })).toBe(duplicateKey({ name: "a", phone: "", address: "" }));
  });
  it("distingue deux adresses ou deux téléphones", () => {
    const base = { name: "A", phone: "", address: "" };
    expect(duplicateKey({ ...base, address: "Rue 1" })).not.toBe(duplicateKey({ ...base, address: "Rue 2" }));
    expect(duplicateKey({ ...base, phone: "111111" })).not.toBe(duplicateKey({ ...base, phone: "222222" }));
  });
});

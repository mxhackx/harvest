import { describe, expect, it, vi } from "vitest";
import { normalizeFacebook, normalizeGoogleMapsUrl, normalizePhone, normalizeWebsite } from "./fields.js";
import { coordsFromGoogleMapsUrl, geocodeAddress, parseGoogleMapsCoords } from "./locate.js";
import { neutralizeFormula, toCsv, toExportRow } from "./export.js";
import { config } from "../config.js";

describe("champs de contact", () => {
  it("refuse tout schéma autre que http(s)", () => {
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("data:text/html,<script>")).toBeNull();
    expect(normalizeWebsite("ftp://exemple.com")).toBeNull();
    expect(normalizeGoogleMapsUrl("javascript:alert(1)")).toBeNull();
  });
  it("site web : ajoute https:// et exige un domaine", () => {
    expect(normalizeWebsite("monsite.bj")).toBe("https://monsite.bj/");
    expect(normalizeWebsite("http://monsite.bj/a?b=1")).toBe("http://monsite.bj/a?b=1");
    expect(normalizeWebsite("pas un site")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
    expect(normalizeWebsite("  ")).toBe("");
  });
  it("Facebook : lien ou identifiant, jamais un autre domaine", () => {
    expect(normalizeFacebook("@pharmacie.etoile")).toBe("https://www.facebook.com/pharmacie.etoile");
    expect(normalizeFacebook("facebook.com/pharmacie")).toBe("https://facebook.com/pharmacie");
    expect(normalizeFacebook("https://m.facebook.com/p/abc")).toBe("https://m.facebook.com/p/abc");
    expect(normalizeFacebook("https://evil.example/facebook.com")).toBeNull();
    expect(normalizeFacebook("https://facebook.com.evil.example/x")).toBeNull();
    expect(normalizeFacebook("a b")).toBeNull();
  });
  it("Google Maps : uniquement des liens de cartes Google", () => {
    expect(normalizeGoogleMapsUrl("https://maps.app.goo.gl/AbCd123")).toBe("https://maps.app.goo.gl/AbCd123");
    expect(normalizeGoogleMapsUrl("https://www.google.com/maps/place/X/@6.36,2.41,17z")).toContain("/maps/place/");
    expect(normalizeGoogleMapsUrl("https://www.google.com/search?q=x")).toBeNull();
    expect(normalizeGoogleMapsUrl("https://google.com.evil.example/maps")).toBeNull();
    expect(normalizeGoogleMapsUrl("https://evil.example/maps")).toBeNull();
  });
  it("WhatsApp : numéro international nettoyé", () => {
    expect(normalizePhone("+229 97 00-11 22")).toBe("+22997001122");
    expect(normalizePhone("00229 97001122")).toBe("+22997001122");
    expect(normalizePhone("(229) 97001122")).toBe("22997001122");
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
  });
});

describe("liens Google Maps → coordonnées", () => {
  it("lit les formats usuels, du plus précis au moins précis", () => {
    expect(parseGoogleMapsCoords("https://www.google.com/maps/place/X/@6.40,2.30,17z/data=!3d6.3654!4d2.3912")).toEqual({ lat: 6.3654, lng: 2.3912 });
    expect(parseGoogleMapsCoords("https://www.google.com/maps/@6.3654,2.3912,15z")).toEqual({ lat: 6.3654, lng: 2.3912 });
    expect(parseGoogleMapsCoords("https://maps.google.com/?q=6.3654,2.3912")).toEqual({ lat: 6.3654, lng: 2.3912 });
    expect(parseGoogleMapsCoords("https://www.google.com/maps?ll=-6.5,-2.5&z=10")).toEqual({ lat: -6.5, lng: -2.5 });
  });
  it("ignore ce qui n'est pas une coordonnée plausible", () => {
    expect(parseGoogleMapsCoords("https://www.google.com/maps/place/Cotonou")).toBeNull();
    expect(parseGoogleMapsCoords("https://www.google.com/maps/@99.5,2.3,15z")).toBeNull();
    expect(parseGoogleMapsCoords("https://www.google.com/maps/@0,0,15z")).toBeNull();
  });
  it("suit un lien court via les redirections Google", async () => {
    const f = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("maps.app.goo.gl")
        ? new Response(null, { status: 302, headers: { location: "https://www.google.com/maps/place/X/@6.37,2.42,17z" } })
        : new Response("", { status: 200 }),
    );
    expect(await coordsFromGoogleMapsUrl("https://maps.app.goo.gl/abc", f as never)).toEqual({ lat: 6.37, lng: 2.42 });
  });
  it("SSRF : ne suit jamais une redirection hors des domaines Google", async () => {
    const hosts: string[] = [];
    const f = vi.fn(async (url: string | URL | Request) => {
      hosts.push(new URL(String(url)).hostname);
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    });
    expect(await coordsFromGoogleMapsUrl("https://maps.app.goo.gl/abc", f as never)).toBeNull();
    expect(hosts).toEqual(["maps.app.goo.gl"]); // le 2e saut (métadonnées cloud) n'est jamais appelé
    expect(await coordsFromGoogleMapsUrl("https://evil.example/x", f as never)).toBeNull();
    expect(hosts).toHaveLength(1);
  });
});

describe("géocodage d'adresse", () => {
  it("interroge le service configuré avec un identifiant générique et lit le résultat", async () => {
    let seen: { url: string; ua: string | null } | null = null;
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), ua: new Headers(init?.headers).get("user-agent") };
      return Response.json([{ lat: "6.3611", lon: "2.4098", display_name: "Haie Vive, Cotonou" }]);
    });
    const r = await geocodeAddress("Haie Vive, Cotonou", f as never);
    expect(r?.coords).toEqual({ lat: 6.3611, lng: 2.4098 });
    expect(seen!.url.startsWith(config.geocoderUrl)).toBe(true);
    expect(seen!.ua).toBe("harvest-api"); // aucune donnée personnelle dans l'en-tête
  });
  it("renvoie null sans résultat, en cas d'erreur réseau ou de réponse invalide", async () => {
    expect(await geocodeAddress("nulle part", (async () => Response.json([])) as never)).toBeNull();
    expect(await geocodeAddress("x", (async () => { throw new Error("réseau"); }) as never)).toBeNull();
    expect(await geocodeAddress("x", (async () => new Response("oops", { status: 500 })) as never)).toBeNull();
    expect(await geocodeAddress("x", (async () => Response.json([{ lat: "abc", lon: "def" }])) as never)).toBeNull();
    expect(await geocodeAddress("   ")).toBeNull();
  });
});

describe("export CSV", () => {
  const lead = (over = {}) => ({
    id: "1", name: "Boulangerie", status: "to_visit", sector: "Commerce", contactName: "", phone: "+229 97 00 11 22",
    whatsapp: "+22997001122", facebook: "", website: "", googleMapsUrl: "", address: "Rue 12, Cadjehoun", city: "Cotonou",
    landmark: "", lat: 6.36, lng: 2.39, locationSource: "manual", estimatedValue: 1000, visitedAt: null, lostReason: "", closedAt: null,
    createdAt: new Date("2026-11-23T10:00:00Z"), updatedAt: new Date("2026-11-23T10:00:00Z"), ...over,
  });
  it("BOM, en-tête, échappement des séparateurs, guillemets et sauts de ligne", () => {
    const csv = toCsv([toExportRow(lead({ name: 'Chez "Awa", le meilleur', landmark: "ligne1\nligne2" }), "Aris")]);
    expect(csv.startsWith("﻿id,name,")).toBe(true);
    expect(csv).toContain('"Chez ""Awa"", le meilleur"');
    expect(csv).toContain('"ligne1\nligne2"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("séparateur point-virgule pour Excel en français", () => {
    const csv = toCsv([toExportRow(lead({ address: "Rue 12; Cadjehoun" }), "Aris")], ";");
    expect(csv.split("\r\n")[0]).toContain(";name;");
    expect(csv).toContain('"Rue 12; Cadjehoun"');
  });
  it("neutralise les formules mais garde les numéros de téléphone", () => {
    expect(neutralizeFormula("=HYPERLINK(\"http://evil\",\"x\")")).toBe("'=HYPERLINK(\"http://evil\",\"x\")");
    expect(neutralizeFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeFormula("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(neutralizeFormula("-2+3")).toBe("'-2+3");
    expect(neutralizeFormula("+22997001122")).toBe("+22997001122");
    expect(neutralizeFormula("+229 97 00 11 22")).toBe("+229 97 00 11 22");
    expect(neutralizeFormula("Boulangerie")).toBe("Boulangerie");
  });
  it("valeurs nulles vides, booléens et dates lisibles", () => {
    const row = toExportRow(lead({ lat: null, lng: null, visitedAt: new Date("2026-11-24T09:00:00Z") }), "Aris");
    expect(row.lat).toBeNull();
    expect(row.visited).toBe(true);
    expect(row.visitedAt).toBe("2026-11-24T09:00:00.000Z");
    expect(row.statusLabel).toBe("À visiter");
  });
});

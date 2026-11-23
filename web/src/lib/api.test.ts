import { describe, expect, it } from "vitest";
import { ApiError, LEAD_STATUSES, STATUS_COLOR, STATUS_LABEL, describeError, errorMessage, formatDay, formatValue, leadLinks, safeHttpUrl, savedMessage } from "./api";

describe("safeHttpUrl", () => {
  it("accepte http et https", () => {
    expect(safeHttpUrl("https://exemple.bj/a?b=1")).toBe("https://exemple.bj/a?b=1");
    expect(safeHttpUrl("http://exemple.bj")).toBe("http://exemple.bj/");
  });
  it("refuse tout autre schéma, ce qui empêche un lien javascript: enregistré de devenir cliquable", () => {
    for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<b>x", "file:///etc/passwd", "ftp://x.y", "vbscript:x", "//evil.example", "pas un lien", ""]) {
      expect(safeHttpUrl(bad), bad).toBeNull();
    }
  });
});

describe("leadLinks", () => {
  const none = { whatsapp: "", facebook: "", website: "", googleMapsUrl: "" };
  it("ne renvoie que les canaux renseignés, dans un ordre stable", () => {
    expect(leadLinks(none)).toEqual([]);
    const all = leadLinks({ whatsapp: "+22997001122", facebook: "https://www.facebook.com/p", website: "https://p.bj/", googleMapsUrl: "https://maps.app.goo.gl/x" });
    expect(all.map((l) => l.key)).toEqual(["whatsapp", "facebook", "website", "maps"]);
    expect(all[0].href).toBe("https://wa.me/22997001122");
  });
  it("WhatsApp : seuls les chiffres comptent, et il en faut au moins 6", () => {
    expect(leadLinks({ ...none, whatsapp: "+229 97 00 11 22" })[0].href).toBe("https://wa.me/22997001122");
    expect(leadLinks({ ...none, whatsapp: "12345" })).toEqual([]);
    expect(leadLinks({ ...none, whatsapp: "abc" })).toEqual([]);
  });
  it("écarte un lien dangereux même s'il est déjà en base", () => {
    const links = leadLinks({ whatsapp: "", facebook: "javascript:alert(1)", website: "data:text/html,x", googleMapsUrl: "https://maps.app.goo.gl/x" });
    expect(links.map((l) => l.key)).toEqual(["maps"]);
  });
});

describe("savedMessage", () => {
  it("dit clairement si le lead est sur la carte et d'où vient sa position", () => {
    expect(savedMessage({ lat: 6.3, lng: 2.4, locationSource: "manual" }, "created")).toBe("Lead ajouté et placé sur la carte.");
    expect(savedMessage({ lat: 6.3, lng: 2.4, locationSource: "address" }, "created")).toContain("approximative");
    expect(savedMessage({ lat: 6.3, lng: 2.4, locationSource: "google_maps" }, "created")).toContain("Google Maps");
    expect(savedMessage({ lat: null, lng: null, locationSource: "" }, "created")).toContain("sans position");
  });
  it("modification", () => {
    expect(savedMessage({ lat: 6.3, lng: 2.4, locationSource: "manual" }, "updated")).toBe("Lead mis à jour.");
    expect(savedMessage({ lat: null, lng: null, locationSource: "" }, "updated")).toContain("toujours pas de position");
  });
});

describe("describeError", () => {
  it("nomme le premier champ refusé, en français", () => {
    const e = new ApiError(400, "invalid_body", [{ message: "adresse de site web invalide", path: ["website"] }]);
    expect(describeError(e)).toBe("Site web : adresse de site web invalide");
  });
  it("reprend la phrase précise d'un fichier d'import inutilisable", () => {
    const e = new ApiError(400, "import_invalid_json");
    e.message = "JSON invalide : Unexpected token";
    expect(describeError(e)).toBe("JSON invalide : Unexpected token");
  });
  it("retombe sur un message générique pour une erreur inconnue", () => {
    expect(describeError(new Error("boom"))).toBe("Une erreur est survenue, réessayez.");
    expect(describeError(new ApiError(403, "forbidden"))).toBe("Vous n'avez pas le droit de faire cela.");
    expect(describeError(null)).toBe("Une erreur est survenue, réessayez.");
    expect(errorMessage("code_inconnu")).toBe("Une erreur est survenue, réessayez.");
  });
});

describe("formats", () => {
  it("nombres à la française, sans devise", () => {
    expect(formatValue(150000).replace(/\s/g, " ")).toBe("150 000");
    expect(formatValue(0)).toBe("0");
  });
  it("jour et mois", () => {
    expect(formatDay("2026-11-23T10:00:00.000Z")).toBe("23/11");
  });
});

describe("étapes", () => {
  it("chaque étape a un libellé et une couleur distincte", () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual([...LEAD_STATUSES].sort());
    expect(new Set(LEAD_STATUSES.map((s) => STATUS_COLOR[s])).size).toBe(4);
  });
  it("les couleurs de la carte : rouge, bleu, vert translucide, vert vif", () => {
    expect(STATUS_COLOR.to_visit).toBe("#e5484d");
    expect(STATUS_COLOR.interested).toBe("#0868c9");
    expect(STATUS_COLOR.mockup_sent).toMatch(/^rgba\(34, 170, 94, 0\.\d+\)$/); // transparent
    expect(STATUS_COLOR.deposit_paid).toBe("#12c457");
  });
});

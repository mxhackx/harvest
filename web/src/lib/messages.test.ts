import { describe, expect, it } from "vitest";
import { mailtoUrl, renderTemplate, sendUrl, whatsappUrl } from "./messages";

const vars = { contact: "Mme Adjovi", entreprise: "Pharmacie du Port", moi: "Aris" };

describe("renderTemplate", () => {
  it("remplace les variables, y compris répétées et avec espaces", () => {
    expect(renderTemplate("Bonjour {{contact}}, {{ moi }} de {{entreprise}}. {{contact}} ?", vars)).toBe("Bonjour Mme Adjovi, Aris de Pharmacie du Port. Mme Adjovi ?");
  });
  it("laisse les variables inconnues visibles", () => {
    expect(renderTemplate("Salut {{prenom}}", vars)).toBe("Salut {{prenom}}");
  });
  it("n'interprète pas les « $ » du contenu", () => {
    expect(renderTemplate("{{contact}}", { ...vars, contact: "$& $1" })).toBe("$& $1");
  });
});

describe("whatsappUrl", () => {
  it("garde les chiffres et encode le texte", () => {
    expect(whatsappUrl("+229 97 00-11 22", "Bonjour & à bientôt")).toBe("https://wa.me/22997001122?text=Bonjour%20%26%20%C3%A0%20bient%C3%B4t");
  });
  it("refuse un numéro trop court ou vide", () => {
    expect(whatsappUrl("123", "x")).toBeNull();
    expect(whatsappUrl("", "x")).toBeNull();
  });
});

describe("mailtoUrl / sendUrl", () => {
  it("construit un mailto valide, ou null", () => {
    expect(mailtoUrl("a@b.co", "Salut", "Sujet")).toBe("mailto:a@b.co?subject=Sujet&body=Salut");
    expect(mailtoUrl("pas-un-mail", "x")).toBeNull();
  });
  it("choisit le canal du modèle ; WhatsApp retombe sur le téléphone", () => {
    const r = { whatsapp: "", phone: "+22997001122", email: "a@b.co" };
    expect(sendUrl("whatsapp", r, "x")).toContain("wa.me/22997001122");
    expect(sendUrl("email", r, "x")).toContain("mailto:a@b.co");
    expect(sendUrl("email", { ...r, email: "" }, "x")).toBeNull();
  });
});

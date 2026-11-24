import { describe, expect, it } from "vitest";
import { activeMention, applyMention, mentionIds, suggest } from "./mentions";

const people = [
  { id: "1", name: "Koffi Mensah" },
  { id: "2", name: "Aïcha Dossou" },
  { id: "3", name: "Awa Kone" },
];

describe("mentions", () => {
  it("repère la mention en cours de frappe, seulement en fin de texte", () => {
    expect(activeMention("Salut @ko")).toEqual({ query: "ko", start: 6 });
    expect(activeMention("@")).toEqual({ query: "", start: 0 });
    expect(activeMention("mail a@b.co")).toBeNull();
    expect(activeMention("Salut @ko merci")).toBeNull();
  });
  it("propose les noms qui commencent par la saisie, sans tenir compte des accents ni du prénom ou nom", () => {
    expect(suggest(people, "ko").map((p) => p.name)).toEqual(["Koffi Mensah", "Awa Kone"]);
    expect(suggest(people, "aic").map((p) => p.name)).toEqual(["Aïcha Dossou"]);
    expect(suggest(people, "").length).toBe(3);
  });
  it("complète la mention et n'envoie que celles encore présentes", () => {
    const text = applyMention("Peux-tu voir @ko", people[0]);
    expect(text).toBe("Peux-tu voir @Koffi Mensah ");
    expect(mentionIds(text, [people[0], people[1]])).toEqual(["1"]);
    expect(mentionIds("plus de mention", [people[0]])).toEqual([]);
  });
});

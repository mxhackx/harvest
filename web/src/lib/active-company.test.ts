import { describe, expect, it } from "vitest";
import { withActiveFirst } from "./active-company";

const ms = ["a", "b", "c"].map((id) => ({ company: { id } }));
describe("withActiveFirst", () => {
  it("place l'entreprise choisie en tête sans perdre les autres", () => {
    expect(withActiveFirst(ms, "c").map((m) => m.company.id)).toEqual(["c", "a", "b"]);
    expect(withActiveFirst(ms, "b").map((m) => m.company.id)).toEqual(["b", "a", "c"]);
  });
  it("id absent, inconnu ou déjà premier : ordre inchangé", () => {
    for (const id of [null, "zzz", "a"]) expect(withActiveFirst(ms, id).map((m) => m.company.id)).toEqual(["a", "b", "c"]);
  });
});

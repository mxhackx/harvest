import { describe, expect, it } from "vitest";
import { findDuplicateGroups } from "./duplicates.js";

const lead = (id: string, name: string, city = "", phone = "") => ({ id, name, city, phone });

describe("findDuplicateGroups", () => {
  it("regroupe par téléphone (formats différents) ou par nom et ville, sans tenir compte du numéro « (2) »", () => {
    const groups = findDuplicateGroups([
      lead("a", "Pharmacie du Port", "Cotonou", "+229 97 00 11 22"),
      lead("b", "Pharma Port", "Porto-Novo", "0022997001122".slice(2)), // même numéro, autre nom
      lead("c", "Salon Prestige", "Cotonou"),
      lead("d", "salon prestige (2)", "cotonou"),
      lead("e", "Garage Moderne", "Cotonou", "12"),
    ]);
    expect(groups.map((g) => [g.reason, g.ids.sort()])).toEqual([["phone", ["a", "b"]], ["name", ["c", "d"]]]);
  });
  it("ne rapproche pas des noms identiques sans ville, ni des téléphones trop courts", () => {
    expect(findDuplicateGroups([lead("a", "Même nom"), lead("b", "Même nom"), lead("c", "x", "", "123"), lead("d", "y", "", "123")])).toEqual([]);
  });
  it("une chaîne de ressemblances forme un seul groupe", () => {
    const g = findDuplicateGroups([lead("a", "A", "V", "+229 90 00 00 01"), lead("b", "B", "V", "+229 90 00 00 01"), lead("c", "B", "V")]);
    expect(g).toHaveLength(1);
    expect(g[0].ids.sort()).toEqual(["a", "b", "c"]);
  });
});

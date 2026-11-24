import { describe, expect, it } from "vitest";
import { describeAction } from "./audit";

describe("describeAction", () => {
  it("traduit les routes connues en phrase", () => {
    expect(describeAction("DELETE /leads/:id")).toBe("a mis à la corbeille le lead");
    expect(describeAction("POST /leads/export")).toBe("a exporté des leads");
  });
  it("montre une route inconnue telle quelle au lieu de la cacher", () => {
    expect(describeAction("POST /nouveau")).toBe("a effectué POST /nouveau");
  });
});

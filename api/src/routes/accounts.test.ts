import { describe, expect, it } from "vitest";
import { summarize } from "./accounts.js";

const kinds = new Map<string, "open" | "won" | "lost">([["new", "open"], ["won", "won"], ["lost", "lost"]]);

describe("summarize", () => {
  it("compte les opportunités, la valeur en cours et la valeur gagnée (le perdu ne compte pas, la valeur vide vaut 0)", () => {
    expect(
      summarize(
        [
          { status: "new", estimatedValue: 100 },
          { status: "new", estimatedValue: null },
          { status: "won", estimatedValue: 500 },
          { status: "lost", estimatedValue: 900 },
          { status: "étape supprimée", estimatedValue: 10 },
        ],
        kinds,
      ),
    ).toEqual({ opportunities: 5, openValue: 110, wonValue: 500 });
  });
  it("un compte sans opportunité vaut zéro partout", () => {
    expect(summarize([], kinds)).toEqual({ opportunities: 0, openValue: 0, wonValue: 0 });
  });
});

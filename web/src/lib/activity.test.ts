import { describe, expect, it } from "vitest";
import { describeActivity, isManualKind, relativeTime } from "./activity";

const NOW = new Date(2026, 5, 15, 14, 30);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("relativeTime", () => {
  it("à l'instant, minutes, heures", () => {
    expect(relativeTime(ago(20_000), NOW)).toBe("à l'instant");
    expect(relativeTime(ago(5 * 60_000), NOW)).toBe("il y a 5 min");
    expect(relativeTime(ago(2 * 3_600_000), NOW)).toBe("il y a 2 h");
  });
  it("hier, puis la date", () => {
    expect(relativeTime(new Date(2026, 5, 14, 9, 5).toISOString(), NOW)).toMatch(/^hier à 09:05$/);
    expect(relativeTime(new Date(2026, 5, 1, 9, 5).toISOString(), NOW)).toMatch(/^1(er)? juin à 09:05$/);
    expect(relativeTime(new Date(2025, 11, 24, 18, 0).toISOString(), NOW)).toContain("2025");
  });
  it("une heure d'hier à plus de 24 h ne devient pas « il y a » aujourd'hui", () => {
    expect(relativeTime(new Date(2026, 5, 14, 16, 0).toISOString(), NOW)).toMatch(/^hier/);
  });
});

describe("describeActivity", () => {
  it("décrit les événements du système", () => {
    expect(describeActivity({ kind: "created", meta: { source: "import" } })).toBe("Lead importé");
    expect(describeActivity({ kind: "created", meta: null })).toBe("Lead créé");
    expect(describeActivity({ kind: "visited", meta: { visited: false } })).toBe("Remis à visiter");
    expect(describeActivity({ kind: "visited", meta: { visited: true } })).toBe("Marqué visité");
    expect(describeActivity({ kind: "stage_change", meta: { from: { name: "À visiter" }, to: { name: "Perdu" }, lostReason: "Trop cher" } })).toBe(
      "Étape : À visiter → Perdu (Trop cher)",
    );
    expect(describeActivity({ kind: "stage_change", meta: null })).toBe("Changement d'étape");
    expect(describeActivity({ kind: "assigned", meta: { from: { name: "Awa" }, to: { name: "Koffi" } } })).toBe("Attribué : Awa → Koffi");
    expect(describeActivity({ kind: "assigned", meta: null })).toBe("Lead attribué");
  });
  it("seuls les types saisis à la main sont modifiables", () => {
    expect(isManualKind("note")).toBe(true);
    expect(isManualKind("stage_change")).toBe(false);
  });
});

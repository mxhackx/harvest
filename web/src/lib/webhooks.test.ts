import { describe, expect, it } from "vitest";
import { webhookState } from "./webhooks";

describe("webhookState", () => {
  it("dit où en est un webhook", () => {
    expect(webhookState({ active: true, lastStatus: null, failures: 0 })).toEqual({ label: "Jamais appelé", ok: true });
    expect(webhookState({ active: true, lastStatus: 204, failures: 0 }).ok).toBe(true);
    expect(webhookState({ active: true, lastStatus: 500, failures: 2 })).toEqual({ label: "Dernier envoi en échec (500)", ok: false });
    expect(webhookState({ active: false, lastStatus: 500, failures: 10 }).label).toContain("Éteint après 10 échecs");
  });
});

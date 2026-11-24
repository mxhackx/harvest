import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Lead } from "./api";
import { CACHED_GET, CACHED_GET_LEAD, applyOptimistic, applyPending, isQueueable, leadIdOf, replay } from "./offline-rules";

const ID = "0f6b3b4e-1111-4222-8333-444455556666";

describe("isQueueable", () => {
  it("accepte « visité » ou l'étape d'un lead, et une note du fil", () => {
    expect(isQueueable({ method: "PATCH", path: `/leads/${ID}`, body: { visited: true } })).toBe(true);
    expect(isQueueable({ method: "PATCH", path: `/leads/${ID}`, body: { visited: true, status: "won" } })).toBe(true);
    expect(isQueueable({ method: "POST", path: `/leads/${ID}/activities`, body: { kind: "note", body: "à rappeler" } })).toBe(true);
  });
  it("refuse tout le reste : autres champs, autres routes, suppression, corps vide", () => {
    expect(isQueueable({ method: "PATCH", path: `/leads/${ID}`, body: { name: "x" } })).toBe(false);
    expect(isQueueable({ method: "PATCH", path: `/leads/${ID}`, body: { visited: true, phone: "1" } })).toBe(false);
    expect(isQueueable({ method: "PATCH", path: `/leads/${ID}`, body: {} })).toBe(false);
    expect(isQueueable({ method: "DELETE", path: `/leads/${ID}`, body: { visited: true } })).toBe(false);
    expect(isQueueable({ method: "POST", path: "/leads", body: { name: "x" } })).toBe(false);
    expect(isQueueable({ method: "POST", path: `/leads/${ID}/emails`, body: { kind: "x", body: "y" } })).toBe(false);
    expect(isQueueable({ method: "PATCH", path: `/leads/${ID}`, body: undefined })).toBe(false);
  });
});

describe("applyOptimistic", () => {
  const lead = { id: ID, status: "to_visit", visitedAt: null } as unknown as Lead;
  const now = new Date("2026-11-24T10:00:00Z");
  it("marque visité à l'heure du geste, sans écraser une visite plus ancienne, et change l'étape", () => {
    expect(applyOptimistic(lead, { method: "PATCH", path: "", body: { visited: true } }, now).visitedAt).toBe("2026-11-24T10:00:00.000Z");
    expect(applyOptimistic({ ...lead, visitedAt: "2026-01-01T00:00:00.000Z" }, { method: "PATCH", path: "", body: { visited: true } }, now).visitedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(applyOptimistic({ ...lead, visitedAt: "x" }, { method: "PATCH", path: "", body: { visited: false } }, now).visitedAt).toBeNull();
    expect(applyOptimistic(lead, { method: "PATCH", path: "", body: { status: "won" } }, now).status).toBe("won");
  });
  it("une note ne change pas le lead à l'écran", () => {
    expect(applyOptimistic(lead, { method: "POST", path: "", body: { kind: "note", body: "x" } }, now)).toBe(lead);
  });
  it("retrouve le lead visé", () => {
    expect(leadIdOf(`/leads/${ID}`)).toBe(ID);
    expect(leadIdOf(`/leads/${ID}/activities`)).toBe(ID);
    expect(leadIdOf("/leads")).toBeNull();
  });
});

describe("applyPending", () => {
  it("rejoue les gestes en attente sur une liste lue du serveur, dans l'ordre, sans toucher les autres leads", () => {
    const a = { id: ID, status: "to_visit", visitedAt: null } as unknown as Lead;
    const b = { id: "other", status: "to_visit", visitedAt: null } as unknown as Lead;
    const now = new Date("2026-11-24T10:00:00Z");
    const out = applyPending([a, b], [
      { method: "PATCH", path: `/leads/${ID}`, body: { visited: true } },
      { method: "PATCH", path: `/leads/${ID}`, body: { status: "won" } },
      { method: "POST", path: `/leads/${ID}/activities`, body: { kind: "note", body: "x" } },
    ], now);
    expect(out[0]).toMatchObject({ status: "won", visitedAt: "2026-11-24T10:00:00.000Z" });
    expect(out[1]).toBe(b);
  });
});

describe("replay", () => {
  const entries = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const run = async (statuses: (number | null)[]) => {
    const removed: number[] = [];
    let i = 0;
    const result = await replay(entries, async () => (i < statuses.length ? statuses[i++] : 200), async (id) => void removed.push(id));
    return { result, removed };
  };
  it("rejoue tout dans l'ordre et vide la file", async () => {
    expect(await run([204, 200, 201, 204])).toEqual({ result: { done: 4, dropped: 0, stoppedOffline: false }, removed: [1, 2, 3, 4] });
  });
  it("s'arrête au premier manque de réseau et garde le reste en attente", async () => {
    expect(await run([204, null])).toEqual({ result: { done: 1, dropped: 0, stoppedOffline: true }, removed: [1] });
  });
  it("abandonne un geste refusé par le serveur (4xx) mais continue ; une erreur serveur (5xx) arrête et garde", async () => {
    expect(await run([404, 204, 204, 204])).toEqual({ result: { done: 3, dropped: 1, stoppedOffline: false }, removed: [1, 2, 3, 4] });
    expect(await run([204, 503])).toEqual({ result: { done: 1, dropped: 0, stoppedOffline: true }, removed: [1] });
  });
});

describe("service worker", () => {
  it("public/sw.js garde en cache les mêmes lectures que les règles de l'application (pas de dérive)", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    for (const p of CACHED_GET) expect(sw, p).toContain(`"${p}"`);
    for (const p of CACHED_GET_LEAD) expect(sw, p).toContain(`"${p}"`);
  });
});

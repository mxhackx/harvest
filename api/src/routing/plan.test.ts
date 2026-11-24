import { describe, expect, it } from "vitest";
import { addMinutes, approximatePlan, haversineKm, orderStops, parseRoute, parseTrip, planRoute, schedule } from "./plan.js";

// Cotonou : trois points alignés d'ouest en est, donnés dans le désordre
const A = { lat: 6.36, lng: 2.38 };
const B = { lat: 6.36, lng: 2.4 };
const C = { lat: 6.36, lng: 2.42 };
const D = { lat: 6.36, lng: 2.44 };

describe("haversineKm", () => {
  it("donne la distance à vol d'oiseau", () => {
    expect(haversineKm(A, A)).toBe(0);
    expect(haversineKm(A, B)).toBeCloseTo(2.2, 1); // 0,02° de longitude à 6°N
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0);
  });
});

describe("orderStops", () => {
  it("garde le départ en premier et enchaîne au plus proche", () => {
    expect(orderStops([A, D, B, C], false)).toEqual([0, 2, 3, 1]); // A, B, C, D
  });
  it("garde l'arrivée fixée en dernier", () => {
    const order = orderStops([A, C, B, D], true); // arrivée = D
    expect(order[0]).toBe(0);
    expect(order[order.length - 1]).toBe(3);
    expect(order).toHaveLength(4);
  });
  it("défait un croisement (2-opt) : le parcours n'est jamais plus long que l'enchaînement simple", () => {
    const pts = [A, D, B, C, { lat: 6.37, lng: 2.39 }, { lat: 6.35, lng: 2.43 }];
    const len = (o: number[]) => o.slice(1).reduce((s, i, k) => s + haversineKm(pts[o[k]], pts[i]), 0);
    expect(len(orderStops(pts, false))).toBeLessThanOrEqual(len([0, 1, 2, 3, 4, 5]));
  });
  it("accepte 0, 1 ou 2 points", () => {
    expect(orderStops([], false)).toEqual([]);
    expect(orderStops([A], false)).toEqual([0]);
    expect(orderStops([A, B], true)).toEqual([0, 1]);
  });
});

describe("approximatePlan", () => {
  it("estime les tronçons (routes ≈ +30 %, 35 km/h) et marque le plan comme approximatif", () => {
    const plan = approximatePlan([A, C, B], true, false);
    expect(plan.approximate).toBe(true);
    expect(plan.order).toEqual([0, 2, 1]);
    expect(plan.legs).toHaveLength(2);
    expect(plan.totalKm).toBeCloseTo(plan.legs.reduce((s, l) => s + l.distanceKm, 0), 1);
    expect(plan.geometry[0]).toEqual([A.lng, A.lat]);
  });
  it("sans optimisation, l'ordre donné est conservé", () => {
    expect(approximatePlan([A, D, B], false, false).order).toEqual([0, 1, 2]);
  });
});

describe("réponses OSRM", () => {
  const leg = (km: number, min: number) => ({ distance: km * 1000, duration: min * 60 });
  it("lit un « trip » : l'ordre vient de waypoint_index, les tronçons sont convertis", () => {
    const plan = parseTrip(
      { code: "Ok", trips: [{ legs: [leg(3.04, 7.4), leg(5, 12)], geometry: { coordinates: [[2.38, 6.36], [2.4, 6.36], [2.42, 6.36]] } }], waypoints: [{ waypoint_index: 0 }, { waypoint_index: 2 }, { waypoint_index: 1 }] },
      3,
    );
    expect(plan).toMatchObject({ order: [0, 2, 1], legs: [{ distanceKm: 3, durationMin: 7 }, { distanceKm: 5, durationMin: 12 }], totalKm: 8, totalMin: 19, approximate: false });
    expect(plan?.geometry).toHaveLength(3);
  });
  it("lit une « route » dans l'ordre donné, et refuse une réponse incohérente", () => {
    expect(parseRoute({ code: "Ok", routes: [{ legs: [leg(1, 2)], geometry: { coordinates: [[1, 1], [2, 2]] } }] }, 2)?.order).toEqual([0, 1]);
    expect(parseRoute({ code: "NoRoute" }, 2)).toBeNull();
    expect(parseRoute({ code: "Ok", routes: [{ legs: [], geometry: { coordinates: [] } }] }, 3)).toBeNull();
    expect(parseTrip({ code: "Ok", trips: [], waypoints: [] }, 3)).toBeNull();
  });
});

describe("planRoute", () => {
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  it("utilise le service quand il répond, sinon estime (erreur réseau, code d'erreur, réponse illisible, service coupé)", async () => {
    const trip = { code: "Ok", trips: [{ legs: [{ distance: 2000, duration: 240 }], geometry: { coordinates: [[2.38, 6.36], [2.4, 6.36]] } }], waypoints: [{ waypoint_index: 0 }, { waypoint_index: 1 }] };
    expect((await planRoute([A, B], { optimize: false, fixedEnd: false }, ok({ code: "Ok", routes: [{ legs: [{ distance: 2000, duration: 240 }], geometry: { coordinates: [[2.38, 6.36], [2.4, 6.36]] } }] }), "http://osrm")).approximate).toBe(false);
    expect((await planRoute([A, C, B], { optimize: true, fixedEnd: false }, ok(trip), "http://osrm")).approximate).toBe(true); // réponse incohérente (2 points pour 3)
    const failing = (async () => { throw new Error("réseau"); }) as unknown as typeof fetch;
    expect((await planRoute([A, B], { optimize: true, fixedEnd: false }, failing, "http://osrm")).approximate).toBe(true);
    expect((await planRoute([A, B], { optimize: true, fixedEnd: false }, ok({}), "")).approximate).toBe(true); // service coupé : aucun appel
  });
  it("un seul point : rien à relier", async () => {
    expect(await planRoute([A], { optimize: true, fixedEnd: false })).toMatchObject({ order: [0], legs: [], totalKm: 0 });
  });
});

describe("horaires", () => {
  it("additionne des minutes en passant minuit", () => {
    expect(addMinutes("08:00", 75)).toBe("09:15");
    expect(addMinutes("23:50", 20)).toBe("00:10");
  });
  it("calcule l'arrivée à chaque étape en comptant le temps passé sur place, sauf à l'arrivée", () => {
    const legs = [{ distanceKm: 3, durationMin: 10 }, { distanceKm: 4, durationMin: 15 }, { distanceKm: 2, durationMin: 5 }];
    expect(schedule("08:00", legs, 20)).toEqual({ arrivals: ["08:10", "08:45", "09:10"], endsAt: "09:10", totalMinutes: 70 });
    expect(schedule("08:00", [], 20)).toEqual({ arrivals: [], endsAt: "08:00", totalMinutes: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { orderRoute, pathLength, routeLine, type Point } from "./route";

/** Générateur pseudo-aléatoire à graine : les tests sont reproductibles. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const cotonou = (n: number, seed: number): Point[] => {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ lat: 6.3 + r() * 0.15, lng: 2.3 + r() * 0.25 }));
};

const key = (p: Point) => `${p.lat},${p.lng}`;
const k = (pts: Point[]) => Math.cos((pts.reduce((s, p) => s + p.lat, 0) / pts.length) * (Math.PI / 180));

// intersection stricte de deux segments, dans le même repère « aplati » que l'algorithme
function cross(a: Point, b: Point, c: Point, d: Point, kk: number) {
  const P = (p: Point) => [p.lng * kk, p.lat] as const;
  const [ax, ay] = P(a), [bx, by] = P(b), [cx, cy] = P(c), [dx, dy] = P(d);
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  return o(ax, ay, bx, by, cx, cy) !== o(ax, ay, bx, by, dx, dy) && o(cx, cy, dx, dy, ax, ay) !== o(cx, cy, dx, dy, bx, by);
}

describe("orderRoute", () => {
  it("renvoie les mêmes points, chacun une seule fois", () => {
    const pts = cotonou(40, 1);
    const out = orderRoute(pts);
    expect(out).toHaveLength(pts.length);
    expect(new Set(out.map(key))).toEqual(new Set(pts.map(key)));
  });

  it("cas limites : aucun, un ou deux points, copie sans modifier l'entrée", () => {
    expect(orderRoute([])).toEqual([]);
    const one = [{ lat: 6.3, lng: 2.4 }];
    expect(orderRoute(one)).toEqual(one);
    const two = [{ lat: 6.3, lng: 2.4 }, { lat: 6.4, lng: 2.3 }];
    const out = orderRoute(two);
    expect(out).toHaveLength(2);
    expect(out).not.toBe(two);
    const input = cotonou(10, 2);
    const copy = [...input];
    orderRoute(input);
    expect(input).toEqual(copy);
  });

  it("part du point le plus à l'ouest", () => {
    const pts = cotonou(30, 3);
    const west = [...pts].sort((a, b) => a.lng - b.lng)[0];
    expect(orderRoute(pts)[0]).toEqual(west);
  });

  it("est déterministe, quel que soit l'ordre d'entrée", () => {
    const pts = cotonou(25, 4);
    const shuffled = [...pts].reverse();
    expect(orderRoute(pts).map(key)).toEqual(orderRoute(shuffled).map(key));
  });

  it("ne produit aucun croisement de segments (parcours localement optimal)", () => {
    for (let seed = 10; seed < 40; seed++) {
      const out = orderRoute(cotonou(14, seed));
      const kk = k(out);
      for (let i = 0; i < out.length - 1; i++)
        for (let j = i + 2; j < out.length - 1; j++)
          expect(cross(out[i], out[i + 1], out[j], out[j + 1], kk), `graine ${seed} : segments ${i} et ${j}`).toBe(false);
    }
  });

  it("n'est jamais plus long que le simple enchaînement du plus proche voisin", () => {
    for (let seed = 50; seed < 70; seed++) {
      const pts = cotonou(20, seed);
      const kk = k(pts);
      const rest = [...pts].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
      const nn = [rest.shift()!];
      while (rest.length) {
        const last = nn[nn.length - 1];
        let best = 0;
        rest.forEach((p, i) => {
          if (Math.hypot(last.lat - p.lat, (last.lng - p.lng) * kk) < Math.hypot(last.lat - rest[best].lat, (last.lng - rest[best].lng) * kk)) best = i;
        });
        nn.push(rest.splice(best, 1)[0]);
      }
      expect(pathLength(orderRoute(pts), kk)).toBeLessThanOrEqual(pathLength(nn, kk) + 1e-9);
    }
  });

  it("des points alignés sont parcourus d'un bout à l'autre", () => {
    const pts = [5, 1, 4, 2, 3, 0].map((i) => ({ lat: 6.3, lng: 2.3 + i * 0.01 }));
    expect(orderRoute(pts).map((p) => Math.round((p.lng - 2.3) * 100))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("supporte des points confondus", () => {
    const p = { lat: 6.3, lng: 2.4 };
    expect(orderRoute([p, p, p, { lat: 6.31, lng: 2.41 }])).toHaveLength(4);
  });

  it("reste rapide et complet avec beaucoup de points", () => {
    const pts = cotonou(600, 7);
    const t = Date.now();
    const out = orderRoute(pts);
    expect(Date.now() - t).toBeLessThan(2000);
    expect(new Set(out.map(key)).size).toBe(new Set(pts.map(key)).size);
  });
});

describe("routeLine", () => {
  it("donne des coordonnées GeoJSON [longitude, latitude]", () => {
    const line = routeLine([{ lat: 6.3, lng: 2.3 }, { lat: 6.4, lng: 2.5 }, { lat: 6.35, lng: 2.4 }]);
    expect(line).toHaveLength(3);
    expect(line[0]).toEqual([2.3, 6.3]);
    for (const [lng, lat] of line) {
      expect(lng).toBeGreaterThan(2);
      expect(lat).toBeGreaterThan(6);
    }
  });
});

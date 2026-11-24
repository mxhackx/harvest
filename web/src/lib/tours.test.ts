import { describe, expect, it } from "vitest";
import { formatDuration, formatKm, googleMapsUrl, moveStop, toGpx, toggleStop } from "./tours";

const start = { lat: 6.36, lng: 2.38, label: "Hôtel" };
const stop = (n: number) => ({ leadId: `l${n}`, name: `Étape ${n}`, city: "", phone: "", lat: +(6.36 + n / 100).toFixed(2), lng: 2.4 });

describe("formatDuration / formatKm", () => {
  it("écrit les durées et les distances en français", () => {
    expect(formatDuration(40)).toBe("40 min");
    expect(formatDuration(95)).toBe("1 h 35");
    expect(formatDuration(125)).toBe("2 h 05");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatKm(12.34).replace(/\s/g, " ")).toBe("12,3 km");
  });
});

describe("googleMapsUrl", () => {
  it("départ, étapes intermédiaires, et la dernière étape comme destination quand il n'y a pas d'arrivée fixée", () => {
    const { url, truncated } = googleMapsUrl(start, [stop(1), stop(2), stop(3)], null);
    const q = new URL(url).searchParams;
    expect(q.get("origin")).toBe("6.36,2.38");
    expect(q.get("destination")).toBe("6.39,2.4");
    expect(q.get("waypoints")).toBe("6.37,2.4|6.38,2.4");
    expect(truncated).toBe(false);
  });
  it("avec une arrivée fixée, toutes les étapes sont intermédiaires ; au-delà de 9, on tronque et on le signale", () => {
    expect(new URL(googleMapsUrl(start, [stop(1)], start).url).searchParams.get("waypoints")).toBe("6.37,2.4");
    const many = Array.from({ length: 12 }, (_, i) => stop(i + 1));
    const r = googleMapsUrl(start, many, start);
    expect(new URL(r.url).searchParams.get("waypoints")!.split("|")).toHaveLength(9);
    expect(r.truncated).toBe(true);
  });
});

describe("toGpx", () => {
  it("contient le départ, les étapes numérotées et la trace, avec les caractères spéciaux échappés", () => {
    const gpx = toGpx("Mardi <test> & co", start, [{ ...stop(1), name: "Chez \"Awa\"" }], [[2.38, 6.36], [2.4, 6.37]]);
    expect(gpx).toContain("<name>Mardi &lt;test&gt; &amp; co</name>");
    expect(gpx).toContain("<name>1. Chez &quot;Awa&quot;</name>");
    expect(gpx).toContain('<trkpt lat="6.37" lon="2.4"/>');
    expect(gpx.startsWith("<?xml")).toBe(true);
  });
});

describe("toggleStop / moveStop", () => {
  it("ajoute, retire et plafonne la sélection", () => {
    expect(toggleStop(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleStop(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleStop(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });
  it("déplace d'une place, sans sortir de la liste", () => {
    expect(moveStop(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveStop(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
    expect(moveStop(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });
});

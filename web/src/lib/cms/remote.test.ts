import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { newSite } from "./model";
import { createSaver, type SaveStatus } from "./remote";

describe("enregistrement automatique", () => {
  it("regroupe les frappes, suit la version et s'arrête sur un conflit", async () => {
    vi.useFakeTimers();
    const seen: SaveStatus[] = [];
    const sent: [string, number][] = [];
    let fail = false;
    const saver = createSaver(async (s, version) => {
      if (fail) throw new ApiError(409, "site_conflict");
      sent.push([s.name, version]);
      return { version: version + 1 };
    }, (s) => seen.push(s), 100);
    const site = { ...newSite("A"), id: "1" };
    saver.track("1", 1);
    saver.change({ ...site, name: "Ab" });
    saver.change({ ...site, name: "Abc" });
    await vi.advanceTimersByTimeAsync(150);
    expect(sent).toEqual([["Abc", 1]]);
    saver.change({ ...site, name: "Abcd" });
    await vi.advanceTimersByTimeAsync(150);
    expect(sent.at(-1)).toEqual(["Abcd", 2]);
    fail = true;
    saver.change({ ...site, name: "écrasement" });
    await vi.advanceTimersByTimeAsync(150);
    expect(seen.at(-1)).toBe("conflict");
    expect(saver.unsaved()).toBe(true);
    vi.useRealTimers();
  });
});

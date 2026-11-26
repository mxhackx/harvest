import { describe, expect, it } from "vitest";
import { BLOCKS, addNode, canConnect, chain, check, removeNode, type Graph } from "./workflows";

const start: Graph = { nodes: [{ id: "s", type: "start", label: "Start", position: { x: 0, y: 0 }, disabled: false, locked: false, config: BLOCKS.start.config() }], edges: [] };

describe("chaîne d'un workflow", () => {
  const two = addNode(addNode(start, "task", "a"), "approval", "b");

  it("ajoute au bout de la chaîne et refuse branches et boucles", () => {
    expect(chain(two).map((n) => n.id)).toEqual(["s", "a", "b"]);
    expect(canConnect(two, "s", "b")).toBe(false);
    expect(canConnect(two, "b", "a")).toBe(false);
    expect(canConnect(two, "b", "s")).toBe(false);
  });

  it("recoud la chaîne quand on retire un bloc, mais garde Start", () => {
    expect(chain(removeNode(two, "a")).map((n) => n.id)).toEqual(["s", "b"]);
    expect(removeNode(two, "s")).toBe(two);
  });

  it("signale les champs manquants et les blocs isolés", () => {
    const lines = check(addNode(two, "email", "c", { x: 0, y: 200 }));
    expect(lines.find((l) => l.nodeId === "a")?.ok).toBe(false);
    expect(lines.find((l) => l.nodeId === "b")?.ok).toBe(true);
    expect(lines.find((l) => l.nodeId === "c")?.text).toContain("pas relié");
  });
});

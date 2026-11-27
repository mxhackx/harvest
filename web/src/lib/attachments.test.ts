import { describe, expect, it } from "vitest";
import { MAX_BYTES, formatSize, refusal } from "./attachments";

describe("pièces jointes", () => {
  it("refuse un type ou une taille hors limites avant l'envoi", () => {
    expect(refusal({ size: 10, type: "application/pdf" })).toBeNull();
    expect(refusal({ size: MAX_BYTES + 1, type: "image/png" })).toContain("50 Mo");
    expect(refusal({ size: 10, type: "image/svg+xml" })).toContain("PDF");
    expect(formatSize(2.5 * 1024 * 1024)).toBe("2,5 Mo");
  });
});

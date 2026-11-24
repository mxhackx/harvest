import { describe, expect, it } from "vitest";
import { pageFor } from "./contact-bubble";

describe("pageFor", () => {
  it("garde une page de la documentation, ramène le reste à l'entrée de la documentation", () => {
    expect(pageFor("/docs/import/csv")).toBe("/docs/import/csv");
    expect(pageFor("/docs")).toBe("/docs");
    expect(pageFor("/")).toBe("/docs");
    expect(pageFor("/dashboard/crm/leads")).toBe("/docs");
  });
});

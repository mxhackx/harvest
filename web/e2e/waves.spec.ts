import { expect, test } from "@playwright/test";
import { addLead, call, newUser, signIn } from "./helpers";

const COTONOU = { lat: 6.3703, lng: 2.3912 };
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

test("vagues : avancement en direct, leads à repasser, clôture avec bilan figé", async ({ page, context, request }) => {
  const user = await newUser(request);
  const region = await call<{ id: string }>(request, user, "post", "/regions", { name: "Cotonou centre", ...COTONOU, radiusKm: 10 });
  const visited = await addLead(request, user, { name: "Boulangerie Soleil", ...COTONOU });
  await addLead(request, user, { name: "Pharmacie du Port", ...COTONOU });
  await call(request, user, "patch", `/leads/${visited.id}`, { visited: true });
  await call(request, user, "post", "/waves", { regionId: region.id, name: "Semaine 48", startsOn: day(-2), endsOn: day(4), targetVisits: 4 });

  await signIn(context, user);
  await page.goto("/dashboard/waves");
  const card = page.locator("li", { hasText: "Semaine 48" });
  await expect(card.getByText("En cours")).toBeVisible();
  await expect(card.getByText("Objectif : 1 / 4 visites")).toBeVisible();
  await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");

  await card.getByRole("button", { name: "Voir les leads à repasser" }).click();
  await expect(page.getByRole("dialog").getByText("Pharmacie du Port")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Boulangerie Soleil")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await card.getByRole("button", { name: "Clôturer la vague" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clôturer", exact: true }).click();
  const closed = page.locator("section[aria-label='Clôturées'] li", { hasText: "Semaine 48" });
  await expect(closed.getByText("Clôturée", { exact: true })).toBeVisible();
  await expect(closed.getByText(/bilan figé/)).toBeVisible();
});

test("la carte des vagues affiche la légende et le menu a sa section", async ({ page, context, request }) => {
  const user = await newUser(request);
  await signIn(context, user);
  await page.goto("/dashboard/waves/map");
  await expect(page.getByRole("heading", { name: "Carte", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Légende" })).toContainText("En cours");
  await expect(page.getByRole("navigation", { name: "Modules" }).first().getByRole("link", { name: "Vagues" })).toBeVisible();
});

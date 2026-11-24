import { expect, test } from "@playwright/test";
import { addLead, newUser, signIn } from "./helpers";

test("prospect simple : étiquette « À distance », filtre de la liste, et absent de la carte", async ({ page, context, request }) => {
  const user = await newUser(request);
  await addLead(request, user, { name: "Boulangerie Soleil", lat: 6.37, lng: 2.39 });
  await addLead(request, user, { name: "Pharmacie à distance", visitMode: "remote", lat: 6.38, lng: 2.4 });
  await signIn(context, user);
  await page.goto("/dashboard/crm/leads");
  await expect(page.getByRole("link", { name: "Pharmacie à distance" })).toBeVisible();
  await expect(page.locator("article", { hasText: "Pharmacie à distance" }).getByText("À distance")).toBeVisible();

  await page.getByRole("button", { name: /Filtrer/ }).click();
  await page.getByLabel("Type de prospect").selectOption("onsite");
  await expect(page.getByRole("link", { name: "Pharmacie à distance" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Boulangerie Soleil" })).toBeVisible();
});

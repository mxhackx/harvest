import { expect, test } from "@playwright/test";
import { addLead, newUser, signIn } from "./helpers";

test("tournées : départ, étapes, itinéraire optimisé, enregistrement, puis « Mes tournées »", async ({ page, context, request }) => {
  const user = await newUser(request);
  await addLead(request, user, { name: "Loin", lat: 6.36, lng: 2.44 });
  await addLead(request, user, { name: "Proche", lat: 6.36, lng: 2.39 });
  await addLead(request, user, { name: "À distance", lat: 6.36, lng: 2.4, visitMode: "remote" });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 6.36, longitude: 2.38 });
  await signIn(context, user);

  await page.goto("/dashboard/waves/tours");
  // seuls les prospects à visiter en présentiel sont proposés
  const list = page.getByRole("list", { name: "Prospects à visiter" });
  await expect(list.getByText("Loin")).toBeVisible();
  await expect(list.getByText("Proche")).toBeVisible();
  await expect(list.getByText("À distance")).toHaveCount(0);

  await page.getByRole("button", { name: "Ma position" }).click();
  await expect(page.getByText("✓ Ma position")).toBeVisible();
  await list.getByText("Loin").click();
  await list.getByText("Proche").click();
  await page.getByRole("button", { name: "Optimiser l’ordre" }).click();

  // l'ordre calculé : le plus proche d'abord ; le résumé se remplit
  const steps = page.getByRole("region", { name: "Étapes" }).getByRole("listitem").filter({ hasText: /Proche|Loin/ });
  await expect(steps.first()).toContainText("Proche");
  await expect(page.getByRole("list", { name: "Résumé" }).or(page.getByRole("term").first())).toBeVisible();
  await expect(page.getByText(/\d+(,\d)? km/).first()).toBeVisible();

  await page.getByLabel("Nom de la tournée").fill("Mardi Cotonou");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("button", { name: "Enregistrée" })).toBeVisible();

  await page.getByRole("tab", { name: /Mes tournées/ }).click();
  await expect(page.getByText("Mardi Cotonou")).toBeVisible();
  await expect(page.getByText(/2 étapes/)).toBeVisible();
  await page.getByRole("button", { name: "Marquer comme faite" }).click();
  await expect(page.getByText("Faite", { exact: true })).toBeVisible();
});

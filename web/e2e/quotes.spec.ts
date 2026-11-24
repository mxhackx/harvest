import { expect, test } from "@playwright/test";
import { addLead, call, newUser, signIn } from "./helpers";

test("devis : remplir un brouillon, l'envoyer, le faire accepter, et la valeur du lead suit", async ({ page, context, request }) => {
  const user = await newUser(request);
  const lead = await addLead(request, user, { name: "Boulangerie Soleil" });
  await signIn(context, user);
  await page.goto(`/dashboard/crm/leads/${lead.id}`);
  await page.getByRole("button", { name: "Nouveau devis" }).click();

  await expect(page.getByText(/D-\d{4}-0001/).first()).toBeVisible();
  await page.getByLabel("Désignation ligne 1").fill("Site vitrine");
  await page.getByLabel("Quantité ligne 1").fill("1");
  await page.getByLabel("Prix unitaire ligne 1").fill("250000");
  await page.getByLabel("Taxe (%)").fill("18");
  await expect(page.getByText("295 000").first()).toBeVisible(); // 250 000 + 18 %

  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Désignation ligne 1")).toHaveCount(0); // figé : plus de champs à modifier
  await page.getByRole("button", { name: "Le client accepte" }).click();
  await expect(page.getByText("Accepté", { exact: true })).toBeVisible();

  const [saved] = await call<{ estimatedValue: number | null }[]>(request, user, "get", "/leads");
  expect(saved.estimatedValue).toBe(295_000);
});

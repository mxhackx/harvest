import { expect, test } from "@playwright/test";
import { newUser, signIn } from "./helpers";

test("CMS : créer un site, modifier un bloc, en ajouter, lire les contrôles et retrouver le tout", async ({ page, context, request }) => {
  await signIn(context, await newUser(request));
  await page.goto("/cms");
  await page.getByRole("button", { name: "Nouveau site" }).click();
  await page.getByLabel("Titre", { exact: true }).fill("Café Jardin");
  await expect(page.getByRole("heading", { name: "Café Jardin" })).toBeVisible();
  await page.getByRole("tab", { name: "Ajouter" }).click();
  await page.getByRole("button", { name: "+ Galerie" }).click();
  await expect(page.locator('[data-block="gallery"]')).toHaveCount(2);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.locator('[data-block="gallery"]')).toHaveCount(1);
  await page.getByRole("tab", { name: /Contrôles/ }).click();
  await expect(page.getByText("C04 Logo présent")).toBeVisible();
  await page.getByRole("tab", { name: "Thème" }).click();
  await page.getByRole("button", { name: "Jardin" }).click();
  await page.getByRole("button", { name: "Sélectionner : Menu / catalogue" }).click();
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Café Jardin" })).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { newUser, signIn, uniqueEmail } from "./helpers";

test("CMS : écrire sur le canevas, glisser un élément, ajouter une page, styler, exporter", async ({ page, context, request }) => {
  await signIn(context, await newUser(request));
  await page.goto("/cms");
  await page.getByRole("button", { name: "Continuer avec Hivation" }).click();
  await page.getByRole("button", { name: "Nouveau site" }).click();
  const canvas = page.locator(".studio-canvas");

  const title = canvas.locator("h1");
  await title.dblclick();
  await title.fill("Café Jardin");
  await title.press("Enter");
  await expect(canvas.locator("h1")).toHaveText("Café Jardin");

  await page.getByRole("tab", { name: "Ajouter" }).click();
  const before = await canvas.locator('[data-node="button"]').count();
  await page.getByRole("button", { name: "+ Bouton" }).dragTo(canvas.locator("h1"));
  await expect(canvas.locator('[data-node="button"]')).toHaveCount(before + 1);

  await canvas.locator("h1").click();
  await page.getByLabel("Taille", { exact: true }).fill("64");
  await page.getByRole("tab", { name: "Styles" }).click();
  await page.getByRole("button", { name: "Jardin" }).click();
  await canvas.locator("h1").click();
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

  page.once("dialog", (d) => d.accept("Réservation"));
  await page.getByRole("button", { name: "Ajouter une page" }).click();
  await expect(page.getByText("Adresse : /reservation")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter le code" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/-next\.zip$/);
  if (process.env.ZIP) await file.saveAs(process.env.ZIP);

  await expect(page.getByRole("status")).toHaveText("Enregistré");
  await page.reload();
  await expect(page.locator(".studio-canvas h1")).toHaveText("Café Jardin");
});

test("CMS : s'inscrire directement, sans entreprise CRM", async ({ page }) => {
  await page.goto("/cms");
  await page.getByRole("button", { name: "Pas encore de compte ? S’inscrire" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Awa");
  await page.getByLabel("E-mail").fill(uniqueEmail("cms"));
  await page.getByLabel("Mot de passe").fill("motdepasse-ok");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Mes sites" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ouvrir le CRM" })).toHaveCount(0);
});

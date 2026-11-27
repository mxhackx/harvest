import { expect, test } from "@playwright/test";
import { newUser, signIn } from "./helpers";

test("marketplace : parcourir, ajouter à Hivation, poser dans un site, puis depuis le CMS", async ({ page, context, request }) => {
  await signIn(context, await newUser(request));
  await page.goto("http://localhost:3101");
  await page.getByRole("button", { name: "Cartes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Carte produit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bouton WhatsApp", exact: true })).toBeHidden();
  if (process.env.SHOT) {
    await page.getByRole("button", { name: "Tout" }).click();
    await page.screenshot({ path: process.env.SHOT });
  }
  // le lien « Ajouter à Hivation » vise le CMS de développement en local : ici, celui des tests
  await page.goto("/cms?add=carte-avis");
  await page.getByRole("button", { name: "Nouveau site" }).click();
  await page.getByRole("button", { name: "Poser ici" }).click();
  const canvas = page.locator(".studio-canvas");
  await expect(canvas.getByText("« Accueil chaleureux et service rapide. »")).toBeVisible();

  await page.getByRole("tab", { name: "Composants" }).click();
  await page.getByLabel("Rechercher un composant").fill("chiffres");
  await page.getByRole("button", { name: "+ Chiffres clés" }).click();
  await expect(canvas.getByText("500+")).toBeVisible();
  await page.reload();
  await expect(page.locator(".studio-canvas").getByText("500+")).toBeVisible();
});

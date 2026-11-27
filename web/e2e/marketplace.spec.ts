import { expect, test } from "@playwright/test";
import { newUser, signIn } from "./helpers";

test("marketplace : parcourir, ajouter à Hivation, poser dans un site, puis depuis le CMS", async ({ page, context, request }) => {
  await signIn(context, await newUser(request));
  await page.goto("http://localhost:3101");
  await page.getByRole("button", { name: "Cartes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Carte produit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bouton WhatsApp", exact: true })).toBeHidden();
  await expect(page.getByRole("link", { name: "Ajouter à Hivation" })).toHaveCount(0);
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
  if (process.env.SHOT3) await page.screenshot({ path: process.env.SHOT3 });
  await page.getByRole("button", { name: "+ Chiffres clés" }).click();
  await expect(canvas.getByText("500+")).toBeVisible();
  await page.reload();
  await expect(page.locator(".studio-canvas").getByText("500+")).toBeVisible();

  // galerie en grand dans l'éditeur, puis section « Composants » de l'accueil du CMS
  await page.getByRole("banner").getByRole("button", { name: "Composants" }).click();
  await page.getByLabel("Rechercher dans la galerie").fill("étiquette");
  await page.getByRole("button", { name: "Poser : Étiquette « Nouveau »" }).click();
  await expect(page.locator(".studio-canvas").getByText("Nouveau", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retour à mes sites" }).click();
  await page.getByRole("tab", { name: "Composants" }).click();
  const cards = page.getByRole("list", { name: "Galerie de composants" }).getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Ajouter :/ }) });
  await expect(cards).toHaveCount(12);
  if (process.env.SHOT2) await page.screenshot({ path: process.env.SHOT2 });
  const more = page.getByRole("button", { name: /Charger plus/ });
  while (await more.count()) await more.click();
  const total = (await (await request.get("http://localhost:3101/r/registry.json")).json()).items.length;
  await expect(cards).toHaveCount(total);
  await page.getByRole("button", { name: "Tarifs", exact: true }).click();
  await expect(cards).toHaveCount(4);
  if (process.env.SHOT3) await page.screenshot({ path: process.env.SHOT3.replace(".png", "-tarifs.png") });
  await page.getByRole("button", { name: "Tout" }).click();
  await page.getByLabel("Rechercher dans la galerie").fill("horaires");
  await page.getByRole("button", { name: "Ajouter : Horaires" }).click();
  await expect(page.locator(".studio-canvas").getByText("Samedi · 10 h – 22 h")).toBeVisible();
});

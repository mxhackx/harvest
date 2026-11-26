import { expect, test } from "@playwright/test";
import { newUser, signIn } from "./helpers";

test("workflows : créer, ajouter des blocs, les régler, vérifier, enregistrer et retrouver le dessin", async ({ page, context, request }) => {
  await signIn(context, await newUser(request));
  await page.goto("/dashboard/ai/workflows");
  await page.getByRole("button", { name: "Nouveau workflow" }).last().click();
  await expect(page).toHaveURL(/workflows\/[0-9a-f-]{36}/);

  await page.getByRole("tab", { name: "Blocs" }).click();
  await page.getByRole("button", { name: /^Agent/ }).click();
  await page.getByRole("tab", { name: "Blocs" }).click();
  await page.getByRole("button", { name: /^Validation/ }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page.getByText("Agent 1 : consigne manquant")).toBeVisible();
  await page.getByText("Agent 1 : consigne manquant").click();
  await page.getByLabel("Consigne").fill("Noter les nouveaux leads");
  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page.getByText("tout est prêt")).toBeVisible();
  await page.screenshot({ path: process.env.SHOT ?? "test-results/workflows.png" });

  if (process.env.SHOT) {
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.screenshot({ path: process.env.SHOT.replace(".png", "-dark.png") });
  }

  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("button", { name: "Enregistré" })).toBeVisible();
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  // retirer le bloc du milieu recoud la chaîne ; annuler le ramène
  await page.locator(".react-flow__node").filter({ hasText: "Agent 1" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
});

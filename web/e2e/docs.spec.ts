import { expect, test } from "@playwright/test";

test("centre d'aide : deux parties, recherche, et la bulle de contact envoie un message", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: "Comment peut-on vous aider ?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Guide utilisateur", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "API et intégrations", level: 2 })).toBeVisible();

  const box = page.getByRole("combobox", { name: "Rechercher dans la documentation" });
  await box.fill("webhook");
  await page.getByRole("listbox", { name: "Résultats" }).getByRole("link", { name: /Webhooks/ }).click();
  await expect(page).toHaveURL(/\/docs\/webhooks$/);
  await expect(page.getByRole("navigation", { name: "Fil d'Ariane" })).toContainText("API et intégrations");

  await page.getByRole("button", { name: "Nous écrire" }).click();
  await page.getByLabel("Votre e-mail").fill("visiteur@example.com");
  await page.getByLabel("Votre message").fill("Comment brancher Zapier ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/votre message est bien reçu/)).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { addLead, newUser, signIn } from "./helpers";

test("comptes : créer un compte depuis un lead, y ajouter une opportunité, voir les chiffres", async ({ page, context, request }) => {
  const user = await newUser(request);
  await addLead(request, user, { name: "Boulangerie Soleil", estimatedValue: 100000 });
  await signIn(context, user);

  await page.goto("/dashboard/crm/leads");
  await page.getByRole("button", { name: "Modifier Boulangerie Soleil" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Créer un compte à partir de ce lead" }).click();
  await expect(page.getByRole("dialog").getByLabel("Entreprise cliente (compte)")).toHaveValue(/.+/);
  await page.keyboard.press("Escape");

  await page.goto("/dashboard/crm/accounts");
  await page.getByRole("link", { name: /Boulangerie Soleil/ }).click();
  await expect(page.getByRole("heading", { name: "Boulangerie Soleil", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle opportunité" }).click();
  await page.getByRole("dialog").getByLabel("Nom de l’opportunité").fill("Soleil — logiciel de caisse");
  await page.getByRole("dialog").getByLabel("Valeur estimée").fill("40000");
  await page.getByRole("dialog").getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByRole("link", { name: /Soleil — logiciel de caisse/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Opportunités" }).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("2 opportunités").first()).toBeVisible();
});

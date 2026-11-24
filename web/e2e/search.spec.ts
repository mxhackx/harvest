import { expect, test } from "@playwright/test";
import { addLead, newUser, signIn } from "./helpers";

test("Ctrl+K ouvre la recherche globale, qui mène à la fiche du lead", async ({ page, context, request }) => {
  const user = await newUser(request);
  await addLead(request, user, { name: "Boulangerie Soleil", city: "Cotonou" });
  await signIn(context, user);
  await page.goto("/dashboard");
  const box = page.getByRole("combobox", { name: "Rechercher dans Hivation" });
  // le raccourci n'existe qu'une fois la page hydratée : on réessaie jusqu'à ce qu'il réponde
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(box).toBeFocused({ timeout: 500 });
  }).toPass();
  await page.keyboard.type("soleil");
  const result = page.getByRole("listbox", { name: "Résultats" }).getByRole("link", { name: /Boulangerie Soleil/ });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/dashboard\/crm\/leads\//);
});

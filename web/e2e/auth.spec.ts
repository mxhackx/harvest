import { expect, test } from "@playwright/test";
import { banner, newUser, signIn, uniqueEmail } from "./helpers";

test.describe("connexion et inscription", () => {
  test("la carte de connexion est centrée, sur fond blanc, avec Google, GitHub et e-mail", async ({ page }) => {
    await page.goto("/login");
    const card = page.locator("div.rounded-card").first();
    const box = (await card.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(2);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe("rgb(255, 255, 255)");
    expect(await card.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");

    for (const name of [/Continuer avec Google/, /Continuer avec GitHub/]) {
      const button = page.getByRole("button", { name });
      await expect(button).toBeVisible();
      await expect(button.locator("svg")).toHaveCount(1); // chaque bouton porte son logo
    }
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("un mauvais mot de passe affiche un message, sans révéler si le compte existe", async ({ page, request }) => {
    const user = await newUser(request, { company: false });
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Mot de passe").fill("pas-le-bon-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    const message = banner(page);
    await expect(message).toHaveText(/E-mail ou mot de passe incorrect\./);
    await page.getByLabel("E-mail").fill(uniqueEmail("inconnu"));
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(banner(page)).toHaveText(/E-mail ou mot de passe incorrect\./); // même message
    await expect(page).toHaveURL(/\/login/);
  });

  test("le message d'erreur est fermable", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("x@y.test");
    await page.getByLabel("Mot de passe").fill("xxxxxxxx");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(banner(page)).toBeVisible();
    await page.getByRole("button", { name: "Fermer" }).click();
    await expect(banner(page)).toHaveCount(0);
  });

  test("Google et GitHub non configurés : retour sur la connexion avec un message clair", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Continuer avec Google/ }).click();
    await expect(page).toHaveURL(/\/login\?error=provider_not_configured/);
    await expect(banner(page)).toHaveText(/Cette connexion n'est pas encore activée\./);
    await page.getByRole("button", { name: /Continuer avec GitHub/ }).click();
    await expect(page).toHaveURL(/error=provider_not_configured/);
  });

  test("inscription, création de l'entreprise, puis tableau de bord vide qui lui appartient", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Créer un compte" }).click();
    await page.getByLabel("Nom", { exact: true }).fill("Jean Dupont");
    await page.getByLabel("E-mail").fill(uniqueEmail("inscription"));
    await page.getByLabel("Mot de passe").fill("motdepasse-ok");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByLabel("Nom de l'entreprise").fill("Boulangerie du Port");
    await page.getByLabel("Secteur").fill("Restauration");
    await page.getByLabel("Région de départ").fill("Cotonou");
    await page.getByRole("button", { name: "Créer mon espace" }).click();

    await expect(page).toHaveURL(/localhost:3100\/$/);
    await expect(page.getByRole("heading", { name: "Bonjour Jean" })).toBeVisible();
    await expect(page.getByText("Rien à visiter pour l'instant.")).toBeVisible();
    await expect(page.getByText("Boulangerie du Port").first()).toBeVisible();
  });

  test("un mot de passe trop court est refusé à l'inscription", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Créer un compte" }).click();
    await page.getByLabel("Nom", { exact: true }).fill("X");
    await page.getByLabel("E-mail").fill(uniqueEmail("court"));
    await page.getByLabel("Mot de passe").fill("abc");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page).toHaveURL(/\/login/); // la validation du navigateur (8 caractères) bloque l'envoi
  });

  test("les pages privées renvoient vers la connexion quand on n'est pas connecté", async ({ page }) => {
    for (const path of ["/", "/leads", "/calendrier"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("déconnexion depuis le menu du profil", async ({ page, context, request }) => {
    const user = await newUser(request);
    await signIn(context, user);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
    await page.getByRole("button", { name: "Menu du compte" }).click();
    await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/); // la session est bien détruite côté serveur
  });
});

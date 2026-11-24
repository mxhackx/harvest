import { expect, test, type Page } from "@playwright/test";
import { addLead, call, newUser, signIn } from "./helpers";

const API = "http://localhost:4100/**";
const item = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) }).and(page.locator("[aria-haspopup=dialog]"));
const peek = (page: Page) => page.locator("aside[role=dialog]");

// Ce test s'appuie sur le service worker : il vaut pour le site compilé (next build / next start), où le code de
// l'application est complet. En développement, Next recharge le code à chaud et la lecture hors ligne n'est pas fiable.
test.skip(process.env.E2E_OFFLINE !== "1", "lancer avec npm run test:e2e:offline (site compilé)");

test("hors connexion : les données restent lisibles, « visité » est mis en attente puis envoyé au retour du réseau", async ({ page, context, request }) => {
  const user = await newUser(request);
  const lead = await addLead(request, user, { name: "Boulangerie Soleil" });
  await signIn(context, user);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Bonjour Aris" })).toBeVisible();

  // le service worker contrôle la page, et les données de l'écran sont en copie
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(item(page, "Boulangerie Soleil")).toBeVisible();

  // coupure du réseau, y compris pour le service worker (setOffline seul ne l'atteint pas)
  await context.route(API, (route) => route.abort("internetdisconnected"));
  await context.setOffline(true);
  await page.reload();
  await expect(item(page, "Boulangerie Soleil")).toBeVisible(); // lu depuis la copie
  await expect(page.getByRole("status")).toContainText("Hors connexion");

  // geste de terrain : « Marquer visité » hors ligne
  await item(page, "Boulangerie Soleil").click();
  await peek(page).getByRole("button", { name: "Marquer visité" }).click();
  await expect(page.getByRole("status")).toContainText("1 action en attente");
  await expect(peek(page).getByRole("button", { name: "Remettre à visiter" })).toBeVisible(); // visible tout de suite à l'écran

  // retour du réseau : l'action part, et la vraie donnée est enregistrée
  await context.unroute(API);
  await context.setOffline(false);
  await expect(page.getByRole("status")).toContainText("synchronisée", { timeout: 20_000 });
  const [saved] = await call<{ id: string; visitedAt: string | null }[]>(request, user, "get", "/leads");
  expect(saved.id).toBe(lead.id);
  expect(saved.visitedAt).not.toBeNull();
});

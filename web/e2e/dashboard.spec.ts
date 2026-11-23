import { expect, test, type Page } from "@playwright/test";
import { addLead, banner, call, newUser, signIn, type User } from "./helpers";

async function open(page: Page, context: Parameters<typeof signIn>[0], user: User) {
  await signIn(context, user);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bonjour Aris" })).toBeVisible();
}

const item = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) }).and(page.locator("[aria-haspopup=dialog]"));
const peek = (page: Page) => page.locator("aside[role=dialog]");

test.describe("tableau de bord", () => {
  test("salue l'utilisateur et résume son périmètre", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "A", status: "to_visit" });
    await addLead(request, user, { name: "B", status: "to_visit" });
    await addLead(request, user, { name: "C", status: "interested" });
    await open(page, context, user);
    await expect(page.getByText("2 lieux à visiter, 0 déjà visité.")).toBeVisible();
    const tile = (label: string) => page.locator("dl > div", { has: page.getByText(label, { exact: true }) });
    await expect(tile("À visiter")).toHaveText(/^2/);
    await expect(tile("Total")).toHaveText(/^3/);
  });

  test("le calendrier n'est plus sur le tableau de bord", async ({ page, context, request }) => {
    await open(page, context, await newUser(request));
    await expect(page.getByRole("heading", { name: "Agenda" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ajouter un rendez-vous" })).toHaveCount(0);
  });

  test("aucun lead : message d'accueil", async ({ page, context, request }) => {
    await open(page, context, await newUser(request));
    await expect(page.getByText("Rien à visiter pour l'instant.")).toBeVisible();
    await expect(page.getByText(/Rien à décider/)).toBeVisible();
  });
});

test.describe("« Prochaines visites » : une carte dans l'angle supérieur droit", () => {
  test("cliquer sur un élément ouvre une carte en haut à droite avec le détail du lead", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, {
      name: "Boulangerie Soleil",
      sector: "Commerce",
      contactName: "Mme Adjovi",
      phone: "+229 97 00 11 22",
      address: "Cadjehoun",
      city: "Cotonou",
      estimatedValue: 150000,
      whatsapp: "+22997001122",
      lat: 6.3654,
      lng: 2.3912,
    });
    await open(page, context, user);
    await item(page, "Boulangerie Soleil").click();

    await expect(peek(page)).toBeVisible();
    const box = (await peek(page).boundingBox())!;
    const vp = page.viewportSize()!;
    expect(vp.width - (box.x + box.width)).toBe(24); // marge de 24 px à droite
    expect(box.y).toBeGreaterThanOrEqual(56); // sous l'en-tête
    expect(box.y).toBeLessThanOrEqual(80);
    expect(box.width).toBe(320);

    await expect(peek(page)).toContainText("Boulangerie Soleil");
    await expect(peek(page)).toContainText("Commerce");
    await expect(peek(page)).toContainText("Mme Adjovi");
    await expect(peek(page)).toContainText("+229 97 00 11 22");
    await expect(peek(page)).toContainText("Cadjehoun, Cotonou");
    await expect(peek(page).locator("dd", { hasText: /150\s000/ })).toBeVisible();
    await expect(peek(page).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/22997001122");
    await expect(peek(page).getByRole("link", { name: "Itinéraire" })).toBeVisible();
    await expect(item(page, "Boulangerie Soleil")).toHaveAttribute("aria-expanded", "true");
  });

  test("Échap, la croix et un second clic referment la carte", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Lead Un" });
    await open(page, context, user);
    await item(page, "Lead Un").click();
    await expect(peek(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(peek(page)).toHaveCount(0);
    await item(page, "Lead Un").click();
    await peek(page).getByRole("button", { name: "Fermer" }).click();
    await expect(peek(page)).toHaveCount(0);
    await item(page, "Lead Un").click();
    await item(page, "Lead Un").click();
    await expect(peek(page)).toHaveCount(0);
  });

  test("cliquer sur un autre élément remplace le contenu de la carte", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Premier" });
    await addLead(request, user, { name: "Second" });
    await open(page, context, user);
    await item(page, "Premier").click();
    await expect(peek(page)).toContainText("Premier");
    await item(page, "Second").click();
    await expect(peek(page)).toContainText("Second");
    await expect(peek(page)).toHaveCount(1);
  });

  test("« Marquer visité » met la carte à jour, et le lead quitte la liste des visites à faire", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "À visiter vite" });
    await open(page, context, user);
    await item(page, "À visiter vite").click();
    await peek(page).getByRole("button", { name: "Marquer visité" }).click();
    await expect(peek(page).getByRole("button", { name: "Remettre à visiter" })).toBeVisible();
    await expect(page.getByText("0 lieu à visiter, 1 déjà visité.")).toBeVisible();
    const [lead] = await call<{ visitedAt: string | null }[]>(request, user, "get", "/leads");
    expect(lead.visitedAt).not.toBeNull();
  });

  test("« Modifier le lead » ouvre la fiche et referme la carte", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "À modifier" });
    await open(page, context, user);
    await item(page, "À modifier").click();
    await peek(page).getByRole("button", { name: "Modifier le lead" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "À modifier" })).toBeVisible();
    await expect(peek(page)).toHaveCount(0);
    await page.getByRole("dialog").getByLabel("Nom de l'entreprise").fill("Modifié");
    await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
    await expect(banner(page)).toHaveText(/Lead mis à jour/);
    await expect(page.getByRole("button", { name: /^Modifié/ })).toBeVisible();
  });

  test("sur mobile, la carte prend la largeur de l'écran", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Mobile" });
    await page.setViewportSize({ width: 390, height: 800 });
    await open(page, context, user);
    await item(page, "Mobile").click();
    const box = (await peek(page).boundingBox())!;
    expect(box.width).toBe(390 - 24);
    expect(box.x).toBe(12);
  });

  test("la liste est limitée à cinq éléments", async ({ page, context, request }) => {
    const user = await newUser(request);
    for (let i = 1; i <= 7; i++) await addLead(request, user, { name: `Lead numéro ${i}` });
    await open(page, context, user);
    await expect(page.locator("[aria-haspopup=dialog]")).toHaveCount(5);
  });
});

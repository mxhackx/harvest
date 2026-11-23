import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { addLead, backdateLead, banner, call, hex, mapReady, newUser, pixelsOfColor, signIn, type User } from "./helpers";

const RED = hex("#e5484d");
const BLUE = hex("#0868c9");
const BRIGHT_GREEN = hex("#12c457");

async function seed(request: APIRequestContext, user: User) {
  const lead = (name: string, status: string, lat: number, lng: number, extra = {}) => addLead(request, user, { name, status, lat, lng, ...extra });
  return {
    r1: await lead("Rouge Un", "to_visit", 6.3654, 2.3912),
    r2: await lead("Rouge Deux", "to_visit", 6.3611, 2.4098),
    r3: await lead("Rouge Trois", "to_visit", 6.3552, 2.4501),
    blue: await lead("Bleu Intéressé", "interested", 6.4009, 2.3443, { sector: "Services", phone: "+229 97 00 11 22" }),
    green: await lead("Vert Maquette", "mockup_sent", 6.352, 2.368),
    paid: await lead("Vert Payé", "deposit_paid", 6.37, 2.43),
  };
}

async function openDashboard(page: Page, context: Parameters<typeof signIn>[0], user: User) {
  await signIn(context, user);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await mapReady(page);
}

const canvas = (page: Page) => page.locator("canvas").first();
const shot = async (page: Page) => pixelsOfColor(await canvas(page).screenshot(), RED);
const radio = (page: Page, name: RegExp) => page.getByRole("radio", { name });
const pill = (page: Page, name: RegExp) => page.getByRole("button", { name });

test.describe("carte : leads de la journée", () => {
  test("par défaut, seuls les leads du jour s'affichent ; « Tous les leads » les montre tous", async ({ page, context, request }) => {
    const user = await newUser(request);
    const s = await seed(request, user);
    backdateLead(s.r3.id, 3); // créé il y a 3 jours : pas de la journée
    await openDashboard(page, context, user);

    await expect(radio(page, /Aujourd.hui/)).toHaveAttribute("aria-checked", "true");
    await expect(radio(page, /Aujourd.hui/)).toContainText("5");
    await expect(radio(page, /Tous les leads/)).toContainText("6");
    await expect(pill(page, /^À visiter 2$/)).toBeVisible(); // Rouge Trois est écarté

    await radio(page, /Tous les leads/).click();
    await expect(radio(page, /Tous les leads/)).toHaveAttribute("aria-checked", "true");
    await expect(pill(page, /^À visiter 3$/)).toBeVisible();
    await radio(page, /Aujourd.hui/).click();
    await expect(pill(page, /^À visiter 2$/)).toBeVisible();
  });

  test("un lead ancien qui a un rendez-vous aujourd'hui revient sur la carte du jour", async ({ page, context, request }) => {
    const user = await newUser(request);
    const s = await seed(request, user);
    backdateLead(s.r1.id, 10);
    await openDashboard(page, context, user);
    await expect(radio(page, /Aujourd.hui/)).toContainText("5");

    await call(request, user, "post", "/events", { title: "Visite Rouge Un", startsAt: new Date().toISOString(), leadId: s.r1.id });
    await page.reload();
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
    await expect(radio(page, /Aujourd.hui/)).toContainText("6");
  });

  test("un lead visité aujourd'hui compte aussi, même créé il y a longtemps", async ({ page, context, request }) => {
    const user = await newUser(request);
    const s = await seed(request, user);
    backdateLead(s.paid.id, 20);
    await call(request, user, "patch", `/leads/${s.paid.id}`, { visited: true });
    await openDashboard(page, context, user);
    await expect(radio(page, /Aujourd.hui/)).toContainText("6");
  });

  test("rien pour aujourd'hui : un message l'explique et propose d'afficher tous les leads", async ({ page, context, request }) => {
    const user = await newUser(request);
    const s = await seed(request, user);
    for (const lead of Object.values(s)) backdateLead(lead.id, 5);
    await openDashboard(page, context, user);
    await expect(page.getByText("Aucun lead pour aujourd’hui")).toBeVisible();
    await page.getByRole("button", { name: "Afficher tous les leads" }).click();
    await expect(page.getByText("Aucun lead pour aujourd’hui")).toHaveCount(0);
    await expect(radio(page, /Tous les leads/)).toHaveAttribute("aria-checked", "true");
  });

  test("sans aucun lead, la carte invite à en ajouter un", async ({ page, context, request }) => {
    await openDashboard(page, context, await newUser(request));
    await expect(page.getByText("Aucun lead sur la carte")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ajouter un lead" })).toHaveAttribute("href", "/leads");
  });
});

test.describe("carte : points, couleurs et ligne", () => {
  test("la légende donne la couleur de chaque étape : rouge, bleu, vert translucide, vert vif", async ({ page, context, request }) => {
    const user = await newUser(request);
    await seed(request, user);
    await openDashboard(page, context, user);
    const dot = (label: RegExp) => pill(page, label).locator("span[aria-hidden]").first();
    const bg = (label: RegExp) => dot(label).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg(/^À visiter/)).toBe("rgb(229, 72, 77)");
    expect(await bg(/^Intéressé/)).toBe("rgb(8, 104, 201)");
    expect(await bg(/^Maquette envoyée/)).toBe("rgba(34, 170, 94, 0.6)"); // légèrement transparent
    expect(await bg(/^Acompte payé/)).toBe("rgb(18, 196, 87)");
    for (const [label, n] of [[/^À visiter/, "3"], [/^Intéressé/, "1"], [/^Maquette envoyée/, "1"], [/^Acompte payé/, "1"], [/^Toutes étapes/, "6"]] as const) {
      await expect(pill(page, label)).toContainText(n);
    }
  });

  test("les points sont dessinés avec la couleur de leur étape", async ({ page, context, request }) => {
    const user = await newUser(request);
    await seed(request, user);
    await openDashboard(page, context, user);
    const png = await canvas(page).screenshot();
    expect(pixelsOfColor(png, RED).count).toBeGreaterThan(100); // trois points rouges + la ligne
    expect(pixelsOfColor(png, BLUE).count).toBeGreaterThan(40); // un point bleu
    expect(pixelsOfColor(png, BRIGHT_GREEN).count).toBeGreaterThan(40); // un point vert vif
  });

  test("filtrer par étape ne garde que les points de cette étape", async ({ page, context, request }) => {
    const user = await newUser(request);
    await seed(request, user);
    await openDashboard(page, context, user);
    await pill(page, /^Intéressé/).click();
    await page.waitForTimeout(1500);
    const png = await canvas(page).screenshot();
    expect(pixelsOfColor(png, RED).count).toBe(0); // plus aucun point ni ligne rouge
    expect(pixelsOfColor(png, BLUE).count).toBeGreaterThan(40);
    expect(pixelsOfColor(png, BRIGHT_GREEN).count).toBe(0);
  });

  test("une ligne rouge pleine relie les points ; « Parcours affiché » la retire", async ({ page, context, request }) => {
    const user = await newUser(request);
    await seed(request, user);
    await openDashboard(page, context, user);
    const withLine = (await shot(page)).count;
    await pill(page, /Parcours affiché/).click();
    await page.waitForTimeout(800);
    const withoutLine = (await shot(page)).count;
    expect(withLine).toBeGreaterThan(withoutLine + 400); // la ligne ajoute beaucoup de pixels rouges
    expect(withoutLine).toBeGreaterThan(50); // les trois points rouges restent
    await pill(page, /Parcours affiché/).click();
    await page.waitForTimeout(800);
    expect((await shot(page)).count).toBeGreaterThan(withoutLine + 400);
  });

  test("avec un seul point affiché, il n'y a pas de ligne", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Seul", status: "to_visit", lat: 6.36, lng: 2.4 });
    await openDashboard(page, context, user);
    const n = (await shot(page)).count;
    expect(n).toBeGreaterThan(50);
    expect(n).toBeLessThan(250); // un point, pas de ligne
  });
});

test.describe("carte : un clic sur un point", () => {
  test("ouvre une petite carte qui décrit le lead, avec ses actions", async ({ page, context, request }) => {
    const user = await newUser(request);
    await seed(request, user);
    await openDashboard(page, context, user);
    const { count, center } = pixelsOfColor(await canvas(page).screenshot(), BLUE);
    expect(count).toBeGreaterThan(40);
    await canvas(page).click({ position: center });

    const bubble = page.locator("div.absolute.z-20").filter({ hasText: "Bleu Intéressé" });
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText("Services");
    await expect(bubble).toContainText("+229 97 00 11 22");
    await expect(bubble.getByText("Intéressé", { exact: true })).toBeVisible();
    await expect(bubble.getByRole("button", { name: "Marquer visité" })).toBeVisible();
    await expect(bubble.getByRole("link", { name: "Itinéraire" })).toHaveAttribute("href", /openstreetmap\.org\/directions/);
    await bubble.getByRole("button", { name: "Modifier le lead" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Bleu Intéressé" })).toBeVisible();
  });

  test("« Marquer visité » dans la carte met à jour le lead", async ({ page, context, request }) => {
    const user = await newUser(request);
    await seed(request, user);
    await openDashboard(page, context, user);
    await canvas(page).click({ position: pixelsOfColor(await canvas(page).screenshot(), BLUE).center });
    const bubble = page.locator("div.absolute.z-20").filter({ hasText: "Bleu Intéressé" });
    await bubble.getByRole("button", { name: "Marquer visité" }).click();
    await expect(bubble.getByRole("button", { name: "Remettre à visiter" })).toBeVisible();
    const leads = await call<{ name: string; visitedAt: string | null }[]>(request, user, "get", "/leads");
    expect(leads.find((l) => l.name === "Bleu Intéressé")!.visitedAt).not.toBeNull();
  });

  test("cliquer ailleurs sur la carte referme la bulle", async ({ page, context, request }) => {
    const user = await newUser(request);
    await seed(request, user);
    await openDashboard(page, context, user);
    await canvas(page).click({ position: pixelsOfColor(await canvas(page).screenshot(), BLUE).center });
    const bubble = page.locator("div.absolute.z-20").filter({ hasText: "Bleu Intéressé" });
    await expect(bubble).toBeVisible();
    await canvas(page).click({ position: { x: 700, y: 400 } });
    await expect(bubble).toHaveCount(0);
  });
});

test.describe("carte : plein écran", () => {
  test("« Agrandir » occupe tout l'écran, Échap la réduit et la page ne défile pas derrière", async ({ page, context, request }) => {
    const user = await newUser(request);
    await seed(request, user);
    await openDashboard(page, context, user);
    await page.getByRole("button", { name: "Agrandir la carte" }).click();
    const full = page.getByRole("dialog", { name: "Carte de tournée en grand" });
    await expect(full).toBeVisible();
    const box = (await full.boundingBox())!;
    expect(box).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 });
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.waitForTimeout(1500);
    expect((await canvas(page).boundingBox())!.width).toBeGreaterThan(1400); // le canevas a suivi le redimensionnement
    await expect(page.getByRole("button", { name: "Réduire la carte" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(full).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect(page.getByRole("button", { name: "Agrandir la carte" })).toBeFocused();
  });

  test("le bouton « Réduire » referme aussi, et la carte reste interactive en grand", async ({ page, context, request }) => {
    const user = await newUser(request);
    await seed(request, user);
    await openDashboard(page, context, user);
    await page.getByRole("button", { name: "Agrandir la carte" }).click();
    await page.waitForTimeout(1500);
    await radio(page, /Tous les leads/).click();
    await expect(pill(page, /^À visiter 3$/)).toBeVisible();
    await page.getByRole("button", { name: "Réduire la carte" }).click();
    await expect(page.getByRole("dialog", { name: "Carte de tournée en grand" })).toHaveCount(0);
    await expect(radio(page, /Tous les leads/)).toHaveAttribute("aria-checked", "true"); // l'état est conservé
  });
});

test.describe("carte : leads sans position", () => {
  test("une pastille les signale ; « les placer » explique s'il n'y a ni adresse ni lien", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Placé", lat: 6.36, lng: 2.4 });
    await addLead(request, user, { name: "Introuvable" });
    await openDashboard(page, context, user);
    const chip = page.getByRole("button", { name: /1 lead sans position/ });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(banner(page)).toHaveText(/ni adresse ni lien Google Maps/);
  });
});

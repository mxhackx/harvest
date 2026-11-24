import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { addLead, addMember, banner, call, newUser, signIn, type User } from "./helpers";

const board = (page: Page, column: string) => page.locator(`section[aria-label="${column}"]`);
const card = (page: Page, name: string) => page.locator("article", { hasText: name });
const dialog = (page: Page) => page.getByRole("dialog");

async function openLeads(page: Page, context: Parameters<typeof signIn>[0], user: User) {
  await signIn(context, user);
  await page.goto("/dashboard/crm/leads");
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
}

test.describe("ajouter un lead", () => {
  test("le bouton propose deux choix, chacun avec son SVG : remplir à la main ou charger un fichier", async ({ page, context, request }) => {
    await openLeads(page, context, await newUser(request));
    await page.getByRole("button", { name: "Ajouter un lead" }).click();
    await expect(dialog(page).getByRole("heading", { name: "Ajouter des leads" })).toBeVisible();
    for (const name of [/Remplir manuellement/, /Charger un fichier/]) {
      const choice = dialog(page).getByRole("button", { name });
      await expect(choice).toBeVisible();
      await expect(choice.locator("svg")).toHaveCount(1);
    }
    await dialog(page).getByRole("button", { name: /Remplir manuellement/ }).click();
    await expect(dialog(page).getByRole("heading", { name: "Nouveau lead" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ajouter un lead" }).click();
    await dialog(page).getByRole("button", { name: /Charger un fichier/ }).click();
    await expect(dialog(page).getByRole("heading", { name: "Importer des leads" })).toBeVisible();
  });

  test("le choix mène vers la page de documentation du format", async ({ page, context, request }) => {
    await openLeads(page, context, await newUser(request));
    await page.getByRole("button", { name: "Ajouter un lead" }).click();
    const link = dialog(page).getByRole("link", { name: "Voir le format attendu" });
    await expect(link).toHaveAttribute("href", "/docs/import");
  });

  test("saisie manuelle avec un lien Google Maps : le lead est placé sur la carte dès sa création", async ({ page, context, request }) => {
    const user = await newUser(request);
    await openLeads(page, context, user);
    await page.getByRole("button", { name: "Ajouter un lead" }).click();
    await dialog(page).getByRole("button", { name: /Remplir manuellement/ }).click();
    await dialog(page).getByLabel("Nom de l'entreprise").fill("Boutique Maps");
    await dialog(page).getByLabel("Lien Google Maps").fill("https://www.google.com/maps/place/B/@6.37,2.43,17z");
    await dialog(page).getByRole("button", { name: "Ajouter le lead" }).click();
    await expect(banner(page)).toHaveText(/placé sur la carte depuis son lien Google Maps/);
    await expect(board(page, "À visiter").getByRole("heading", { name: "Boutique Maps" })).toBeVisible();
    const [lead] = await call<{ lat: number; lng: number; locationSource: string }[]>(request, user, "get", "/leads");
    expect(lead).toMatchObject({ lat: 6.37, lng: 2.43, locationSource: "google_maps" });
  });

  test("sans adresse ni position, le message dit clairement que le lead n'est pas sur la carte", async ({ page, context, request }) => {
    await openLeads(page, context, await newUser(request));
    await page.getByRole("button", { name: "Ajouter un lead" }).click();
    await dialog(page).getByRole("button", { name: /Remplir manuellement/ }).click();
    await dialog(page).getByLabel("Nom de l'entreprise").fill("Sans position");
    await dialog(page).getByRole("button", { name: "Ajouter le lead" }).click();
    await expect(banner(page)).toHaveText(/sans position/);
    await expect(card(page, "Sans position").locator("span", { hasText: /^Sans position$/ })).toBeVisible(); // l'étiquette, pas le titre
  });

  test("un lien dangereux est refusé avec un message qui nomme le champ", async ({ page, context, request }) => {
    await openLeads(page, context, await newUser(request));
    await page.getByRole("button", { name: "Ajouter un lead" }).click();
    await dialog(page).getByRole("button", { name: /Remplir manuellement/ }).click();
    await dialog(page).getByLabel("Nom de l'entreprise").fill("Test lien");
    await dialog(page).getByLabel("Site web").fill("javascript:alert(1)");
    await dialog(page).getByRole("button", { name: "Ajouter le lead" }).click();
    await expect(dialog(page).getByRole("alert")).toHaveText(/Site web : adresse de site web invalide/);
    await expect(dialog(page)).toBeVisible(); // la fenêtre reste ouverte pour corriger
  });

  test("deux leads de même nom : le suivant devient « Nom (1) »", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Pharmacie Étoile" });
    await openLeads(page, context, user);
    await page.getByRole("button", { name: "Ajouter un lead" }).click();
    await dialog(page).getByRole("button", { name: /Remplir manuellement/ }).click();
    await dialog(page).getByLabel("Nom de l'entreprise").fill("Pharmacie Étoile");
    await dialog(page).getByRole("button", { name: "Ajouter le lead" }).click();
    await expect(board(page, "À visiter").getByRole("heading", { name: "Pharmacie Étoile (1)" })).toBeVisible();
    await expect(board(page, "À visiter").getByRole("heading", { name: "Pharmacie Étoile", exact: true })).toBeVisible();
  });
});

test.describe("modifier un lead", () => {
  test("le crayon de la carte ouvre la fiche ; enregistrer met à jour la carte", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Boulangerie Soleil", sector: "Commerce" });
    await openLeads(page, context, user);
    await page.getByRole("button", { name: "Modifier Boulangerie Soleil" }).click();
    await expect(dialog(page).getByRole("heading", { name: "Boulangerie Soleil" })).toBeVisible();
    await expect(dialog(page).getByLabel("Secteur")).toHaveValue("Commerce");
    await dialog(page).getByLabel("Nom de l'entreprise").fill("Boulangerie du Soleil");
    await dialog(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(banner(page)).toHaveText(/Lead mis à jour/);
    await expect(board(page, "À visiter").getByRole("heading", { name: "Boulangerie du Soleil" })).toBeVisible();
  });

  test("cliquer sur le nom ouvre aussi la fiche, et « Déjà visité » est enregistré", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Salon Prestige" });
    await openLeads(page, context, user);
    await card(page, "Salon Prestige").getByRole("button", { name: "Salon Prestige", exact: true }).click();
    await dialog(page).getByLabel("Déjà visité").check();
    await dialog(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(card(page, "Salon Prestige").getByText(/Visité le/)).toBeVisible();
    const [lead] = await call<{ visitedAt: string | null }[]>(request, user, "get", "/leads");
    expect(lead.visitedAt).not.toBeNull();
  });

  test("changer l'étape depuis la fiche déplace la carte dans la bonne colonne", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Garage Moderne" });
    await openLeads(page, context, user);
    await page.getByRole("button", { name: "Modifier Garage Moderne" }).click();
    await dialog(page).getByLabel("Étape").selectOption("deposit_paid");
    await dialog(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(board(page, "Acompte payé").getByRole("heading", { name: "Garage Moderne" })).toBeVisible();
  });

  test("supprimer depuis la fiche demande une confirmation", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "À supprimer" });
    await openLeads(page, context, user);
    await page.getByRole("button", { name: "Modifier À supprimer" }).click();
    await dialog(page).getByRole("button", { name: "Supprimer ce lead" }).click();
    await expect(dialog(page).getByText(/Supprimer définitivement/)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Annuler" }).click(); // « Annuler » ne supprime rien
    await expect(dialog(page).getByRole("button", { name: "Supprimer ce lead" })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Supprimer ce lead" }).click();
    await dialog(page).getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(banner(page)).toHaveText(/« À supprimer » supprimé/);
    await expect(card(page, "À supprimer")).toHaveCount(0);
  });

  test("sans le droit de modifier, la fiche est en lecture seule", async ({ page, context, request }) => {
    const ceo = await newUser(request);
    const affilie = await addMember(request, ceo, "affilie");
    await addLead(request, affilie, { name: "Lead de l'affilié" }); // il peut créer, pas modifier
    await openLeads(page, context, affilie);
    await card(page, "Lead de l'affilié").getByRole("button", { name: "Lead de l'affilié", exact: true }).click();
    await expect(dialog(page).getByText("Vous n'avez pas le droit de modifier ce lead.")).toBeVisible();
    await expect(dialog(page).getByLabel("Nom de l'entreprise")).toBeDisabled();
    await expect(dialog(page).getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
    await expect(dialog(page).getByRole("button", { name: "Supprimer ce lead" })).toHaveCount(0);
    await expect(dialog(page).getByRole("button", { name: "Fermer", exact: true }).last()).toBeVisible();
  });
});

test.describe("board, tableau et sélection", () => {
  test("glisser une carte dans une autre colonne change son étape", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Boulangerie Soleil" });
    await openLeads(page, context, user);
    await card(page, "Boulangerie Soleil").dragTo(board(page, "Intéressé"));
    await expect(board(page, "Intéressé").getByRole("heading", { name: "Boulangerie Soleil" })).toBeVisible();
    await expect.poll(async () => (await call<{ status: string }[]>(request, user, "get", "/leads"))[0].status).toBe("interested");
  });

  test("sélection multiple : la barre d'actions change l'étape et marque comme visité", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Lead A" });
    await addLead(request, user, { name: "Lead B" });
    await openLeads(page, context, user);
    await page.getByLabel("Sélectionner Lead A").check();
    await page.getByLabel("Sélectionner Lead B").check();
    await expect(page.getByText("2 sélectionnés")).toBeVisible();
    await page.getByRole("button", { name: "Visite" }).click();
    await page.getByRole("menuitem", { name: "Marquer visités" }).click();
    await expect(banner(page)).toHaveText(/2 leads mis à jour/);
    await page.getByLabel("Sélectionner Lead A").check();
    await page.getByRole("button", { name: "Changer l'étape" }).click();
    await page.getByRole("menuitem", { name: "Acompte payé" }).click();
    await expect(board(page, "Acompte payé").getByRole("heading", { name: "Lead A" })).toBeVisible();
    const leads = await call<{ name: string; status: string; visitedAt: string | null }[]>(request, user, "get", "/leads");
    expect(leads.every((l) => l.visitedAt)).toBe(true);
  });

  test("suppression de masse : confirmation, puis les leads disparaissent", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Jeter 1" });
    await addLead(request, user, { name: "Jeter 2" });
    await addLead(request, user, { name: "Garder" });
    await openLeads(page, context, user);
    await page.getByLabel("Sélectionner Jeter 1").check();
    await page.getByLabel("Sélectionner Jeter 2").check();
    await page.getByRole("button", { name: "Supprimer" }).click();
    await expect(dialog(page).getByRole("heading", { name: "Supprimer 2 leads ?" })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(banner(page)).toHaveText(/2 leads supprimés/);
    await expect(card(page, "Garder")).toBeVisible();
    await expect(page.locator("article")).toHaveCount(1);
  });

  test("recherche, filtres et vue tableau", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Pharmacie Étoile", sector: "Santé", lat: 6.36, lng: 2.41 });
    await addLead(request, user, { name: "Boulangerie Soleil", sector: "Commerce" });
    await openLeads(page, context, user);
    await page.getByLabel("Rechercher un lead").fill("pharm");
    await expect(page.locator("article")).toHaveCount(1);
    await page.getByLabel("Rechercher un lead").fill("");
    await expect(page.locator("article")).toHaveCount(2);
    await page.getByRole("button", { name: "Filtrer" }).click();
    await page.getByLabel("Position").selectOption("without");
    await page.keyboard.press("Escape");
    await expect(page.locator("article")).toHaveCount(1);
    await expect(card(page, "Boulangerie Soleil")).toBeVisible();
    await page.getByRole("button", { name: "Vue tableau" }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(2); // en-tête + 1 ligne
    await page.getByRole("button", { name: "Modifier Boulangerie Soleil" }).click();
    await expect(dialog(page).getByRole("heading", { name: "Boulangerie Soleil" })).toBeVisible();
  });

  test("« Mes leads » ne montre que ceux que l'on a créés", async ({ page, context, request }) => {
    const ceo = await newUser(request);
    const manager = await addMember(request, ceo, "manager");
    await addLead(request, ceo, { name: "Du CEO" });
    await addLead(request, manager, { name: "Du manager" });
    await openLeads(page, context, manager);
    await expect(page.locator("article")).toHaveCount(2); // le manager voit tout
    await page.getByRole("tab", { name: /Mes leads/ }).click();
    await expect(page.locator("article")).toHaveCount(1);
    await expect(card(page, "Du manager")).toBeVisible();
  });
});

test.describe("export", () => {
  test("CSV et JSON se téléchargent, avec un nom de fichier daté", async ({ page, context, request }, testInfo) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Pharmacie Étoile", whatsapp: "+22997001122", city: "Cotonou", estimatedValue: 5000 });
    await addLead(request, user, { name: "Salon Prestige" });
    await openLeads(page, context, user);

    const csv = async (item: string | RegExp) => {
      await page.getByRole("button", { name: "Exporter" }).click();
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: item, exact: typeof item === "string" }).click()]);
      const file = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(file);
      return { name: download.suggestedFilename(), raw: await readFile(file) };
    };

    const comma = await csv("CSV");
    expect(comma.name).toMatch(/^leads-\d{4}-\d{2}-\d{2}\.csv$/);
    expect([...comma.raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8
    const text = comma.raw.toString("utf8");
    expect(text).toContain("id,name,status,statusLabel");
    expect(text).toContain("Pharmacie Étoile");
    expect(text).toContain("+22997001122");

    const semi = await csv(/CSV pour Excel/);
    expect(semi.raw.toString("utf8")).toContain("id;name;status;statusLabel");

    const json = await csv("JSON");
    expect(json.name).toMatch(/\.json$/);
    const data = JSON.parse(json.raw.toString("utf8"));
    expect(data.map((l: { name: string }) => l.name).sort()).toEqual(["Pharmacie Étoile", "Salon Prestige"]);
    expect(data.find((l: { name: string }) => l.name === "Pharmacie Étoile")).toMatchObject({ whatsapp: "+22997001122", estimatedValue: 5000, statusLabel: "À visiter" });
  });

  test("depuis la sélection, seuls les leads cochés sont exportés", async ({ page, context, request }, testInfo) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Choisi" });
    await addLead(request, user, { name: "Ignoré" });
    await openLeads(page, context, user);
    await page.getByLabel("Sélectionner Choisi").check();
    await page.getByRole("button", { name: "Exporter" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "JSON" }).click()]);
    const file = testInfo.outputPath("selection.json");
    await download.saveAs(file);
    expect(JSON.parse(await readFile(file, "utf8")).map((l: { name: string }) => l.name)).toEqual(["Choisi"]);
  });

  test("sans le droit d'exporter, le bouton n'est pas proposé", async ({ page, context, request }) => {
    const ceo = await newUser(request);
    const worker = await addMember(request, ceo, "worker");
    await addLead(request, ceo, { name: "Un lead" });
    await openLeads(page, context, worker);
    await expect(page.getByRole("button", { name: "Exporter" })).toHaveCount(0);
    await openLeads(page, context, ceo);
    await expect(page.getByRole("button", { name: "Exporter" })).toBeVisible();
  });
});

test.describe("import", () => {
  const IMPORT_CSV = [
    "name,address,phone,status",
    "Nouvelle Pharmacie,Haie Vive,,À visiter",
    "Existant,Rue 1,+229 11 22 33 44,À visiter", // doublon d'un lead déjà présent
    "Mauvaise étape,,,en pause", // ligne 4 : étape inconnue
    "Salon Awa,Akpakpa,,Intéressé",
  ].join("\n");

  async function openImport(page: Page) {
    await page.getByRole("button", { name: "Ajouter un lead" }).click();
    await dialog(page).getByRole("button", { name: /Charger un fichier/ }).click();
    await expect(dialog(page).getByRole("heading", { name: "Importer des leads" })).toBeVisible();
  }

  test("analyse à blanc, rapport détaillé, puis import des lignes valides", async ({ page, context, request }) => {
    const user = await newUser(request);
    await addLead(request, user, { name: "Existant", phone: "+229 11 22 33 44", address: "Rue 1" });
    await openLeads(page, context, user);
    await openImport(page);
    await dialog(page).locator('input[type="file"]').setInputFiles({ name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(IMPORT_CSV) });
    await dialog(page).getByRole("button", { name: "Analyser" }).click();

    const stat = (label: string) => dialog(page).locator("dl > div", { has: page.getByText(label, { exact: true }) });
    await expect(stat("à importer")).toHaveText(/^2/);
    await expect(stat("doublons ignorés")).toHaveText(/^1/);
    await expect(stat("invalides ignorées")).toHaveText(/^1/);
    await expect(dialog(page).getByText("ligne 4")).toBeVisible();
    await expect(dialog(page).getByText(/étape inconnue « en pause »/)).toBeVisible();
    await expect(dialog(page).getByText("Nouvelle Pharmacie")).toBeVisible(); // aperçu
    expect((await call<unknown[]>(request, user, "get", "/leads")).length).toBe(1); // l'analyse n'a rien créé

    await dialog(page).getByRole("button", { name: "Importer 2 leads" }).click();
    await expect(banner(page)).toHaveText(/2 leads importés/);
    await expect(banner(page)).toHaveText(/1 doublon ignoré/);
    await expect(banner(page)).toHaveText(/1 ligne invalide ignorée/);
    await expect(card(page, "Nouvelle Pharmacie")).toBeVisible();
    await expect(board(page, "Intéressé").getByRole("heading", { name: "Salon Awa" })).toBeVisible();
    expect((await call<unknown[]>(request, user, "get", "/leads")).length).toBe(3);
  });

  test("on peut aussi coller le contenu d'un JSON", async ({ page, context, request }) => {
    await openLeads(page, context, await newUser(request));
    await openImport(page);
    await dialog(page).getByLabel("Ou collez le contenu ici").fill(JSON.stringify([{ name: "Collé 1" }, { nom: "Collé 2", étape: "Intéressé" }]));
    await dialog(page).getByRole("button", { name: "Analyser" }).click();
    await dialog(page).getByRole("button", { name: "Importer 2 leads" }).click();
    await expect(banner(page)).toHaveText(/2 leads importés/);
    await expect(board(page, "Intéressé").getByRole("heading", { name: "Collé 2" })).toBeVisible();
  });

  test("les noms identiques sont numérotés, et le rapport le dit avant d'importer", async ({ page, context, request }) => {
    await openLeads(page, context, await newUser(request));
    await openImport(page);
    await dialog(page).getByLabel("Ou collez le contenu ici").fill("name,address\nPharmacie,Rue 1\nPharmacie,Rue 2");
    await dialog(page).getByRole("button", { name: "Analyser" }).click();
    await expect(dialog(page).getByText("Pharmacie (1)")).toBeVisible();
    await dialog(page).getByRole("button", { name: "Importer 2 leads" }).click();
    await expect(board(page, "À visiter").getByRole("heading", { name: "Pharmacie (1)" })).toBeVisible();
  });

  test("un fichier inutilisable donne un message précis", async ({ page, context, request }) => {
    await openLeads(page, context, await newUser(request));
    await openImport(page);
    await dialog(page).getByLabel("Ou collez le contenu ici").fill("[{name: oups}]");
    await dialog(page).getByRole("button", { name: "Analyser" }).click();
    await expect(dialog(page).getByRole("alert")).toHaveText(/JSON invalide/);
    await dialog(page).getByLabel("Ou collez le contenu ici").fill("secteur,ville\nx,y");
    await dialog(page).getByRole("button", { name: "Analyser" }).click();
    await expect(dialog(page).getByRole("alert")).toHaveText(/Aucune colonne « name »/);
  });

  test("« Analyser » est désactivé tant qu'il n'y a rien à analyser", async ({ page, context, request }) => {
    await openLeads(page, context, await newUser(request));
    await openImport(page);
    await expect(dialog(page).getByRole("button", { name: "Analyser" })).toBeDisabled();
  });

  test("les modèles de la documentation s'importent sans aucune erreur", async ({ page, context, request }) => {
    await openLeads(page, context, await newUser(request));
    for (const [file, label] of [["leads-modele.csv", "CSV"], ["leads-modele.json", "JSON"]] as const) {
      const content = await (await request.get(`http://localhost:3100/templates/${file}`)).text();
      await openImport(page);
      await dialog(page).getByLabel("Ou collez le contenu ici").fill(content.replace(/^﻿/, ""));
      await dialog(page).getByRole("button", { name: "Analyser" }).click();
      const stat = (l: string) => dialog(page).locator("dl > div", { has: page.getByText(l, { exact: true }) });
      await expect(stat("à importer"), label).toHaveText(/^3/);
      await expect(stat("invalides ignorées"), label).toHaveText(/^0/);
      await page.keyboard.press("Escape");
    }
  });
});

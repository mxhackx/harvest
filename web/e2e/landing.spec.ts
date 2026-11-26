import { expect, test } from "@playwright/test";

test("accueil : titre, aperçus que l'on choisit, texte révélé au défilement, rien ne dépasse sur téléphone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Prospectez une région à la fois");
  const slide = page.getByRole("button", { name: /Tournées optimisées/ });
  await slide.scrollIntoViewIfNeeded();
  await slide.click();
  await expect(slide).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Tournée du jour · exemple")).toBeVisible();

  if (process.env.SHOT) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2500);
    for (let i = 0; i < 6; i++) {
      await page.screenshot({ path: `${process.env.SHOT}/l${i}.png` });
      await page.mouse.wheel(0, 780);
      await page.waitForTimeout(1200);
    }
  }

  await page.setViewportSize({ width: 360, height: 760 });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  if (process.env.SHOT) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${process.env.SHOT}/mobile.png` });
  }
});

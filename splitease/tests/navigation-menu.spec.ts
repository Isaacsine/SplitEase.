import { test, expect } from "@playwright/test";
for (const width of [320, 390, 768])
  test(
    "phone navigation stays visible and clear of actions at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      await expect(nav).toBeVisible();
      const bounds = (await nav.boundingBox())!;
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(845);
      expect(bounds.y).toBeGreaterThan(700);
      const dock = (await page.locator(".checkoutbar").boundingBox())!;
      expect(dock.y + dock.height).toBeLessThanOrEqual(bounds.y);
      for (const name of [
        "Split",
        "Scan to pay",
        "Activity",
        "Plans",
        "Balances",
        "Help",
      ])
        await expect(
          nav.getByRole("link", { name, exact: true }),
        ).toBeVisible();
      await nav.getByRole("link", { name: "Help", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Here to help." }),
      ).toBeVisible();
      await expect(
        nav.getByRole("link", { name: "Help", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    },
  );
test("desktop navigation and resizing preserve access to every destination", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  expect((await nav.boundingBox())!.y).toBeLessThan(90);
  await nav.getByRole("link", { name: "Plans", exact: true }).click();
  await expect(
    nav.getByRole("link", { name: "Plans", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Help", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Here to help." }),
  ).toBeVisible();
});

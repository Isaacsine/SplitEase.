import { test, expect } from "@playwright/test";
for (const width of [320, 390, 768])
  test(
    "compact navigation opens, closes and routes at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const menu = page.getByRole("button", {
        name: "Open navigation",
        exact: true,
      });
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(
        page.getByRole("navigation", { name: "Main navigation" }),
      ).not.toBeVisible();
      await menu.click();
      await expect(
        page.getByRole("button", { name: "Close navigation" }),
      ).toHaveAttribute("aria-expanded", "true");
      await expect(
        page.getByRole("link", { name: "Wallet", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await menu.click();
      await page.getByRole("link", { name: "Wallet", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Wallet", exact: true }),
      ).toBeVisible();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await menu.click();
      await page.locator(".wallet-balance h2").click();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    },
  );
test("desktop uses visible links and resizing resets the compact menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: "Plans", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(
    page.getByRole("link", { name: "Wallet", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
});

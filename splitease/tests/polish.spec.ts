import { test, expect } from "@playwright/test";
test("Help contains real support contacts and expandable guidance", async ({
  page,
}) => {
  await page.goto("/#help");
  await expect(
    page.getByRole("link", { name: "Chat on WhatsApp" }),
  ).toHaveAttribute("href", /^https:\/\/wa.me\/27726816869/);
  await expect(
    page.getByRole("link", { name: "Email support" }),
  ).toHaveAttribute("href", /^mailto:sinethembankosi70@gmail.com/);
  await page.getByText("How do I pay?", { exact: true }).click();
  await expect(page.getByText(/We currently use test payments/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start a split" }),
  ).toHaveAttribute("href", "#pay");
});
test("keyboard skip link preserves the active route", async ({ page }) => {
  await page.goto("/#help");
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page).toHaveURL(/#help$/);
});
test("blocked browser storage still clears memory-only auth data", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.goto("/#help");
  const cleared = await page.evaluate(async () => {
    const { authStorage } = await import("/src/lib/authStorage.ts");
    authStorage.setItem("test-token", "temporary");
    const before = authStorage.getItem("test-token");
    authStorage.removeItem("test-token");
    return before === "temporary" && authStorage.getItem("test-token") === null;
  });
  expect(cleared).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Here to help." }),
  ).toBeVisible();
});
test("failed page imports show recovery actions", async ({ page }) => {
  await page.route("**/src/pages/PlansPage.tsx*", (route) => route.abort());
  await page.goto("/#plans");
  await expect(
    page.getByRole("heading", { name: "Couldn't open this page" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get help", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Here to help." }),
  ).toBeVisible();
});
for (const width of [320, 390, 1366])
  test("polished pages fit at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const hash of ["#pay", "#help", "#scan"]) {
      await page.goto("/" + hash);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(await page.locator("body").innerText()).not.toMatch(
        /\b(demo|simulation|prototype)\b/i,
      );
    }
    await page.goto("/");
    await page.screenshot({
      path: `test-results/polish-home-${width}.png`,
      fullPage: true,
    });
  });

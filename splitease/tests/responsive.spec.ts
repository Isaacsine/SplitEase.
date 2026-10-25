import { test, expect, type Page } from "@playwright/test";
const sizes = [
  { name: "small-phone", width: 320, height: 740 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "large-laptop", width: 1920, height: 1080 },
];
async function fit(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const small = await page
    .locator("button,a.button,nav a,.brand,summary,.upload")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const e = element as HTMLElement;
          const r = e.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            getComputedStyle(e).visibility !== "hidden"
          );
        })
        .flatMap((element) => {
          const e = element as HTMLElement,
            r = e.getBoundingClientRect();
          return r.width < 43.5 || r.height < 43.5
            ? [
                {
                  text: e.innerText.slice(0, 60),
                  width: r.width,
                  height: r.height,
                },
              ]
            : [];
        }),
    );
  expect(small).toEqual([]);
}
for (const size of sizes)
  test(size.name + " controls and pages fit their screen", async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await fit(page);
    await page
      .getByLabel("Split name")
      .fill("A weekend away with friends and family");
    await page.getByLabel("Total to split").fill("999999");
    await page
      .getByRole("button", { name: "+ Add a person", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await fit(page);
    const modal = await page.getByRole("dialog").boundingBox();
    expect(modal!.x).toBeGreaterThanOrEqual(0);
    expect(modal!.x + modal!.width).toBeLessThanOrEqual(size.width);
    await page
      .getByLabel("Name", { exact: true })
      .fill("Alexandra with a long participant name");
    await page.getByRole("button", { name: "Add person", exact: true }).click();
    await page
      .getByLabel("Alexandra with a long participant name payment choice")
      .selectOption("instalments");
    await fit(page);
    await page.getByRole("button", { name: "Your split" }).click();
    await fit(page);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Create payment invites" }).click();
    await fit(page);
    await page.getByText("Show invitation QR code", { exact: true }).click();
    await expect(page.getByAltText("Invitation QR for You")).toBeVisible();
    await fit(page);
    const link = await page.getByLabel("Invite link").inputValue();
    await page.goto(link);
    await page
      .getByRole("button", { name: "Pay in instalments", exact: true })
      .click();
    await page.getByLabel("Repayment plan").selectOption("4");
    await fit(page);
    await expect(page.getByRole("table")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "test-results/responsive/" + size.name + "-instalments.png",
      fullPage: true,
    });
    if (
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
    await page.getByRole("link", { name: "Scan to pay", exact: true }).click();
    await fit(page);
    if (
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
    await page.getByRole("link", { name: "Activity", exact: true }).click();
    await fit(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await fit(page);
    await page.keyboard.press("Escape");
  });

import { test, expect, type Page } from "@playwright/test";
async function makeStokvel(page: Page) {
  await page.clock.install({ time: new Date("2027-01-15T10:00:00Z") });
  await page.goto("/#plans");
  await page.getByRole("button", { name: "New plan", exact: true }).click();
  await page.getByRole("button", { name: "Stokvel", exact: false }).click();
  await page.getByLabel("Plan name", { exact: true }).fill("Our stokvel");
  await page.getByLabel("Person 2", { exact: true }).fill("Alex");
  await page.getByLabel("Where to save").selectOption("local");
  await page.getByRole("button", { name: "Create plan", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Stokvel payout order" }),
  ).toBeVisible();
}
test("members agree order, it locks, payouts wait for month-end and only recipients acknowledge", async ({
  page,
  context,
}) => {
  await makeStokvel(page);
  await page
    .getByRole("button", { name: "Accept contribution & order" })
    .click();
  await page
    .getByLabel("Participant", { exact: true })
    .selectOption({ label: "Alex" });
  const guest = await context.newPage();
  await guest.clock.install({ time: new Date("2027-01-15T10:00:00Z") });
  await guest.goto(await page.getByLabel("Plan participant link").inputValue());
  await guest
    .getByRole("button", { name: "Accept contribution & order" })
    .click();
  await guest.getByText("Propose a different order", { exact: true }).click();
  await guest.getByLabel("Recipient 1").selectOption({ label: "Alex" });
  await guest.getByRole("button", { name: "Propose payout order" }).click();
  await expect(
    page.getByRole("button", { name: "Start monthly plan" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Accept contribution & order" })
    .click();
  await guest
    .getByRole("button", { name: "Accept contribution & order" })
    .click();
  await page.getByRole("button", { name: "Start monthly plan" }).click();
  await expect(page.getByText("Order locked", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Propose a different order", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm You for 2027-01" }).click();
  await page.getByRole("button", { name: "Confirm Alex for 2027-01" }).click();
  await expect(
    page.getByRole("button", { name: /Acknowledge .* payout/ }),
  ).toHaveCount(0);
  await expect(
    guest.getByRole("button", { name: /Acknowledge .* payout/ }),
  ).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2027-01-31T10:00:00Z"));
  await guest.clock.setFixedTime(new Date("2027-01-31T10:00:00Z"));
  await page.reload();
  await guest.reload();
  await expect(
    page.getByRole("button", { name: /Acknowledge .* payout/ }),
  ).toHaveCount(0);
  await guest.getByRole("button", { name: /Acknowledge .* payout/ }).click();
  await expect(
    page.getByRole("region", { name: "Stokvel payout order" }),
  ).toContainText("Acknowledged (preview)");
  await page.clock.setFixedTime(new Date("2027-02-28T10:00:00Z"));
  await page.reload();
  await page.getByRole("button", { name: "Confirm You for 2027-02" }).click();
  await page.getByRole("button", { name: "Confirm Alex for 2027-02" }).click();
  await page.getByRole("button", { name: /Acknowledge .* payout/ }).click();
  await expect(page.getByText("Round finished", { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date("2027-03-15T10:00:00Z"));
  await page.reload();
  const count = await page.evaluate(async () => {
    const api = await import("/src/features/plans/plans.api.ts"),
      model = await import("/src/features/plans/plans.ts");
    return (await api.readPlan(model.parsePlan(location.hash)!)).periods.length;
  });
  expect(count).toBe(4);
});
async function walletEntry(page: Page, amount: string, kind = "add") {
  await page
    .getByRole("combobox", { name: "Wallet action", exact: true })
    .selectOption(kind);
  if (kind === "move") {
    await page
      .getByRole("combobox", { name: "Transfer to", exact: true })
      .selectOption("bank");
    await page
      .getByLabel("Account holder", { exact: true })
      .fill("Test Recipient");
    await page.getByLabel("Bank name", { exact: true }).fill("Test Bank");
    await page.getByLabel("Account number", { exact: true }).fill("1234567890");
  }
  await page.getByLabel("Amount (R)", { exact: true }).fill(amount);
  await page
    .getByRole("button", {
      name: kind === "add" ? "Review deposit" : "Review transfer",
    })
    .click();
  await page
    .getByRole("button", {
      name: kind === "add" ? "Deposit" : "Confirm transfer",
      exact: true,
    })
    .click();
}
test("wallet is deliberate, persistent, idempotent and cannot be overdrawn", async ({
  page,
}) => {
  await page.goto("/#wallet");
  await expect(page.locator(".wallet-balance")).toContainText("0,00");
  await page.getByLabel("Amount (R)", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Review deposit" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".wallet-balance")).toContainText("0,00");
  await walletEntry(page, "500");
  await page.reload();
  await expect(page.locator(".wallet-balance")).toContainText("500,00");
  const result = await page.evaluate(async () => {
    const api = await import("/src/features/wallet/wallet.api.ts");
    const request = crypto.randomUUID();
    await api.walletAction("local", "add", 10000, "Extra set aside", request);
    await api.walletAction("local", "add", 10000, "Extra set aside", request);
    return await api.readWallet("local");
  });
  expect(result.balance).toBe(60000);
  expect(result.entries).toHaveLength(2);
  await page.getByRole("button", { name: "Refresh wallet" }).click();
  await walletEntry(page, "200", "move");
  await expect(page.locator(".wallet-balance")).toContainText("400,00");
  await walletEntry(page, "100", "move");
  await expect(page.locator(".wallet-balance")).toContainText("300,00");
  await page.getByLabel("Amount (R)", { exact: true }).fill("301");
  await page.getByRole("button", { name: "Review transfer" }).click();
  await expect(page.getByRole("alert")).toContainText("Not enough");
  await page.reload();
  await expect(page.locator(".wallet-balance")).toContainText("300,00");
});
for (const width of [320, 768, 1366])
  test("wallet and stokvel fit " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await makeStokvel(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.goto("/#wallet");
    await expect(page.locator(".wallet-balance")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  });

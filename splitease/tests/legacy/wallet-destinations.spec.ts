import { test, expect, type Page } from "@playwright/test";
async function deposit(page: Page, amount = "1000") {
  await page.goto("/#wallet");
  await page.getByLabel("Amount (R)", { exact: true }).fill(amount);
  await page
    .getByRole("button", { name: "Review deposit", exact: true })
    .click();
  await page.getByRole("button", { name: "Deposit", exact: true }).click();
  await expect(page.locator(".wallet-balance")).toContainText(
    amount === "1000" ? "1 000,00" : amount + ",00",
  );
  await page
    .getByRole("combobox", { name: "Wallet action", exact: true })
    .selectOption("move");
}
test("bank transfers require a recipient and record only masked account details", async ({
  page,
}) => {
  await deposit(page);
  await page.getByLabel("Amount (R)", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Review transfer" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".wallet-balance")).toContainText("1 000,00");
  await page
    .getByRole("combobox", { name: "Transfer to", exact: true })
    .selectOption("bank");
  await page.getByLabel("Account holder", { exact: true }).fill("Alex Nkosi");
  await page.getByLabel("Bank name", { exact: true }).fill("Test Bank");
  await page.getByLabel("Account number", { exact: true }).fill("987654321098");
  await page.getByRole("button", { name: "Review transfer" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("Alex Nkosi at Test Bank (ending 1098)");
  await expect(modal).not.toContainText("987654321098");
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".wallet-balance")).toContainText("1 000,00");
  await page.getByRole("button", { name: "Review transfer" }).click();
  await page
    .getByRole("button", { name: "Confirm transfer", exact: true })
    .click();
  await expect(page.locator(".wallet-balance")).toContainText("800,00");
  await expect(page.locator(".wallet-history")).toContainText(
    "To Alex Nkosi | Test Bank *1098",
  );
  const raw = await page.evaluate(() =>
    localStorage.getItem("splitease-wallet-v1"),
  );
  expect(raw).not.toContain("987654321098");
});
test("transfer to a stokvel names the month, fixes the amount and funds that contribution", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const api = await import("/src/features/plans/plans.api.ts"),
      m = await import("/src/features/plans/plans.ts");
    const ref = await api.createPlan(
      {
        title: "Family stokvel",
        kind: "stokvel",
        target: 0,
        start: m.thisMonth(),
        day: 28,
        members: [
          { name: "You", cents: 50000 },
          { name: "Alex", cents: 50000 },
        ],
      },
      "local",
    );
    const p = await api.readPlan(ref);
    await api.changePlan(ref, "accept", p.members[0].id, undefined, {
      revision: 1,
      orderRevision: 1,
    });
    await api.changePlan(
      { ...ref, seat: p.members[1].token },
      "accept",
      p.members[1].id,
      undefined,
      { revision: 1, orderRevision: 1 },
    );
    await api.changePlan(ref, "start");
  });
  await deposit(page);
  await page
    .getByRole("combobox", { name: "Transfer to", exact: true })
    .selectOption("plan");
  const select = page.getByRole("combobox", {
    name: "Contribution",
    exact: true,
  });
  await expect(select.locator("option")).not.toHaveCount(1);
  const id = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(id!);
  await expect(page.getByLabel("Amount (R)", { exact: true })).toHaveValue(
    "500",
  );
  await expect(page.getByLabel("Amount (R)", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await page.getByRole("button", { name: "Review transfer" }).click();
  await expect(page.getByRole("dialog")).toContainText("Family stokvel");
  await page
    .getByRole("button", { name: "Confirm transfer", exact: true })
    .click();
  await expect(page.locator(".wallet-balance")).toContainText("500,00");
  await expect(select.locator('option[value="' + id + '"]')).toHaveCount(0);
  const result = await page.evaluate(async (id) => {
    const api = await import("/src/features/plans/plans.api.ts");
    const list = await api.listPlans();
    return list.entries[0].plan.periods.find((x) => x.id === id)?.status;
  }, id);
  expect(result).toBe("confirmed");
});
for (const width of [320, 768, 1366])
  test("transfer destination form fits " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await deposit(page, "500");
    await page
      .getByRole("combobox", { name: "Transfer to", exact: true })
      .selectOption("bank");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect(
      page.getByLabel("Account number", { exact: true }),
    ).toBeVisible();
  });

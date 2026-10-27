import { test, expect, type Page } from "@playwright/test";
async function deposit(page: Page, amount = "500") {
  await page.goto("/#wallet");
  await expect(page.getByLabel("Description", { exact: true })).toHaveCount(0);
  await page.getByLabel("Amount (R)", { exact: true }).fill(amount);
  await page.getByRole("button", { name: "Review deposit" }).click();
  await page.getByRole("button", { name: "Deposit", exact: true }).click();
  await expect(page.locator(".wallet-balance")).toContainText(amount + ",00");
}
async function plan(page: Page) {
  await page.evaluate(async () => {
    const api = await import("/src/features/plans/plans.api.ts"),
      m = await import("/src/features/plans/plans.ts");
    const ref = await api.createPlan(
      {
        title: "Monthly stokvel",
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
    let p = await api.readPlan(ref);
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
    location.hash = m.planLink(ref).split("#")[1];
  });
  await expect(
    page.getByRole("heading", { name: "Monthly agreements" }),
  ).toBeVisible();
}
test("deposit needs no description; wallet funds stokvel and bank fallback leaves wallet untouched", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2027-01-15T10:00:00Z") });
  await deposit(page);
  await plan(page);
  await page.getByRole("button", { name: /Pay .* from wallet/ }).click();
  await page
    .getByRole("button", { name: "Confirm payment preview", exact: true })
    .click();
  await expect(
    page.locator(".plan-period").filter({ hasText: "You" }),
  ).toContainText("Received");
  let data = await page.evaluate(async () => {
    const a = await import("/src/features/wallet/wallet.api.ts");
    return await a.readWallet("local");
  });
  expect(data.balance).toBe(0);
  expect(data.entries).toHaveLength(2);
  await page.getByLabel("Month", { exact: true }).selectOption("2027-02");
  await expect(
    page.getByRole("button", { name: /Pay .* from wallet/ }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Direct bank payment (preview)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm payment preview", exact: true })
    .click();
  await expect(
    page.locator(".plan-period").filter({ hasText: "You" }),
  ).toContainText("Awaiting confirmation");
  expect(
    await page.evaluate(async () => {
      const a = await import("/src/features/wallet/wallet.api.ts");
      return (await a.readWallet("local")).balance;
    }),
  ).toBe(0);
});
test("restaurant invitation uses wallet, persists debit and prevents a repeated invoice payment", async ({
  page,
}) => {
  await deposit(page, "600");
  await page.goto(
    "/#join=" +
      encodeURIComponent(
        JSON.stringify({
          shopName: "Restaurant dinner",
          totalAmount: 700,
          name: "You",
          share: 350,
        }),
      ),
  );
  await page.getByRole("button", { name: /Pay .* from wallet/ }).click();
  await page
    .getByRole("button", { name: "Confirm payment preview", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No money was sent or collected",
  );
  const result = await page.evaluate(async () => {
    const api = await import("/src/features/wallet/wallet.api.ts"),
      pay = await import("/src/features/wallet/walletPayments.ts");
    const id = await pay.paymentReference(location.hash + "|35000");
    let rejected = false;
    try {
      await pay.payFromWallet(
        { kind: "payment", item: id },
        "local",
        35000,
        crypto.randomUUID(),
      );
    } catch {
      rejected = true;
    }
    return { rejected, wallet: await api.readWallet("local") };
  });
  expect(result.rejected).toBe(true);
  expect(result.wallet.balance).toBe(25000);
  await page.goto("/#wallet");
  await expect(page.locator(".wallet-balance")).toContainText("250,00");
});
test("wallet-funded room payment updates coverage", async ({ page }) => {
  await deposit(page);
  await page.evaluate(async () => {
    const api = await import("/src/features/rooms/rooms.api.ts"),
      model = await import("/src/features/rooms/rooms.ts");
    const ref = api.createGuidedRoom(),
      r = await api.readRoom(ref);
    await api.updateRoom(ref, r.members[0].id, "method", "now", 3);
    location.hash = model.roomLink(ref).split("#")[1];
  });
  await page.getByRole("button", { name: /Pay .* from wallet/ }).click();
  await page
    .getByRole("button", { name: "Confirm payment preview", exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Bill coverage" }),
  ).toHaveAttribute("value", "40000");
  expect(
    await page.evaluate(async () => {
      const api = await import("/src/features/wallet/wallet.api.ts");
      return (await api.readWallet("local")).balance;
    }),
  ).toBe(10000);
});
test("concurrent wallet payments cannot overdraw or debit partially", async ({
  page,
}) => {
  await deposit(page, "100");
  const result = await page.evaluate(async () => {
    const api = await import("/src/features/wallet/walletPayments.ts"),
      wallet = await import("/src/features/wallet/wallet.api.ts");
    const results = await Promise.allSettled([
      api.payFromWallet(
        { kind: "payment", item: crypto.randomUUID() },
        "local",
        8000,
        crypto.randomUUID(),
      ),
      api.payFromWallet(
        { kind: "payment", item: crypto.randomUUID() },
        "local",
        8000,
        crypto.randomUUID(),
      ),
    ]);
    return {
      fulfilled: results.filter((r) => r.status === "fulfilled").length,
      wallet: await wallet.readWallet("local"),
    };
  });
  expect(result.fulfilled).toBe(1);
  expect(result.wallet.balance).toBe(2000);
  expect(result.wallet.entries).toHaveLength(2);
});

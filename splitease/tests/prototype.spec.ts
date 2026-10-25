import { test, expect } from "@playwright/test";
test("payment previews work without a backend and never call a gateway or change payment status", async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/") || url.includes("peachpayments.com")) {
      calls.push(url);
      return route.abort();
    }
    return route.continue();
  });
  const request = {
    shopName: "Dinner",
    totalAmount: 600,
    name: "Alex",
    share: 300,
  };
  await page.goto("/#join=" + encodeURIComponent(JSON.stringify(request)));
  await expect(
    page.getByText("Prototype - no real payments", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Preview payment of/ }).click();
  await expect(page.getByRole("status")).toContainText(
    "No money was sent or collected",
  );
  await page.getByRole("button", { name: "Try preview again" }).click();
  await expect(
    page.getByRole("button", { name: "Preview failed payment" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Preview payment of/ }),
  ).toBeVisible();
  expect(calls).toEqual([]);
});
test("old gateway return links cannot confirm a payment", async ({ page }) => {
  await page.goto(
    "/?status=succeeded#payment-return=11111111-1111-4111-8111-111111111111",
  );
  await expect(
    page.getByRole("heading", { name: "Payment processing is paused" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to your split" }).click();
  await expect(
    page.getByRole("heading", { name: "Expense details" }),
  ).toBeVisible();
});

import { signedInTestAccount } from "./helpers/session";
import { test, expect } from "@playwright/test";
const invitation = (choice = "now") => "/#join=" + encodeURIComponent(JSON.stringify({ shopName: "Dinner", totalAmount: 600, name: "Alex", share: 300, paymentChoice: choice, instalmentCount: 4 }));

test("Pay now uses Stripe and old credit invitations cannot restore simulations", async ({ page }) => {
  for (const choice of ["now", "instalments", "cash"]) {
    await page.goto(invitation(choice));
    await expect(page.getByLabel("Payment environment")).toBeVisible();
    await expect(page.getByRole("button", { name: /Test R.*300[.,]00 with Stripe/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Preview|Pay in instalments|Pay from wallet|Pay directly from bank|Cash/ })).toHaveCount(0);
    await expect(page.getByLabel("Repayment plan")).toHaveCount(0);
  }
});
test("checkout failure never offers a simulated success fallback", async ({ page }) => {
  await signedInTestAccount(page);
  await page.route("**/api/stripe/checkout", route => route.fulfill({ status: 503, json: { error: "Test checkout unavailable" } }));
  await page.goto(invitation()); await page.getByRole("button", { name: /Test R.*with Stripe/ }).click();
  await expect(page.getByRole("alert")).toContainText("Test checkout unavailable");
  await expect(page.getByRole("button", { name: /Test R.*with Stripe/ })).toBeEnabled();
  await expect(page.getByText(/Payment preview complete|Test payment confirmed/)).toHaveCount(0);
});
test("wallet navigation is unavailable and retired test transactions are cleared", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("splitease-wallet-v1", '{"balance":12345,"entries":[]}'));
  await expect(page.getByRole("link", { name: "Wallet", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Pay in instalments" })).toHaveCount(0);
  await page.goto("/#wallet"); await page.reload(); await expect(page.getByRole("heading", { name: "Wallet is unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Deposit|Transfer|Pay from wallet|Add money/ })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("splitease-wallet-v1"))).toBeNull();
});
test("shared room offers only the viewer's Stripe checkout and cannot simulate coverage", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { createGuidedRoom } = await import("/src/features/rooms/rooms.api.ts");
    const ref = createGuidedRoom(); location.hash = "room=" + ref.key + "&mode=demo";
  });
  await expect(page.getByRole("button", { name: /Test R.*with Stripe/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Record contribution|Use instalments|Record repayment|Confirm cash|Complete split|Pay from wallet/ })).toHaveCount(0);
  await expect(page.getByText(/Group totals are not linked yet/)).toBeVisible();
  await page.getByLabel("Participant link", { exact: true }).selectOption({ label: "Lerato" });
  const link = await page.getByLabel("Participant link to share").inputValue();
  const guest = await context.newPage(); await guest.goto(link);
  await expect(guest.getByRole("button", { name: /Test R.*with Stripe/ })).toHaveCount(1);
  await expect(guest.getByRole("heading", { name: "Lerato (you)", exact: true })).toBeVisible();
});
test("old gateway return links cannot confirm a payment", async ({ page }) => {
  await page.goto("/?status=succeeded#payment-return=11111111-1111-4111-8111-111111111111");
  await expect(page.getByRole("heading", { name: "Payment processing is paused" })).toBeVisible();
});

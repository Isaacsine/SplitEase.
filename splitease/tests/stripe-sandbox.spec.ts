import { signedInTestAccount } from "./helpers/session";
import { test, expect } from "@playwright/test";

test("sandbox return checks the backend instead of trusting success in the URL", async ({ page }) => {
  let paid = false;
  await page.route("**/api/stripe/sessions/cs_test_browser*", route => route.fulfill({ json: { id: "cs_test_browser", status: paid ? "succeeded" : "pending", amountCents: 30000, currency: "ZAR", sandbox: true } }));
  await page.goto("/?status=succeeded#stripe-return=cs_test_browser");
  await expect(page.getByRole("status")).toContainText("Stripe has not confirmed payment");
  await expect(page.getByRole("heading", { name: "Test payment confirmed" })).toHaveCount(0);
  paid = true; await page.getByRole("button", { name: "Check payment status" }).click();
  await expect(page.getByRole("heading", { name: "Test payment confirmed" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/300[.,]00/);
});

test("cancelled and forged sandbox links never confirm a payment", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/stripe/**", route => { calls++; return route.fulfill({ status: 404, json: { error: "Not found" } }); });
  await page.goto("/#stripe-return=cancelled"); await expect(page.getByRole("heading", { name: "Checkout cancelled" })).toBeVisible();
  await page.goto("/#stripe-return=cs_live_forged"); await expect(page.getByRole("alert")).toContainText("Invalid sandbox checkout link");
  expect(calls).toBe(0);
});

test("sandbox status failures are recoverable", async ({ page }) => {
  let retry = false;
  await page.route("**/api/stripe/sessions/cs_test_retry", route => route.fulfill(retry ? { json: { status: "expired", sandbox: true } } : { status: 503, json: { error: "Sandbox is unavailable" } }));
  await page.goto("/#stripe-return=cs_test_retry"); await expect(page.getByRole("alert")).toContainText("Sandbox is unavailable");
  retry = true; await page.getByRole("button", { name: "Check payment status" }).click();
  await expect(page.getByRole("heading", { name: "Test checkout expired" })).toBeVisible();
});

test("checkout sends cents, preserves retry identity and opens hosted Stripe", async ({ page }) => {
  await signedInTestAccount(page);
  const requests: { amount: number; key: string | undefined }[] = [];
  await page.route("**/api/stripe/checkout", route => {
    requests.push({ amount: route.request().postDataJSON().amountCents, key: route.request().headers()["idempotency-key"] });
    return route.fulfill(requests.length === 1 ? { status: 502, json: { error: "Please retry checkout" } } : { status: 201, json: { url: "https://checkout.stripe.com/c/pay/cs_test_browser", sandbox: true } });
  });
  await page.route("https://checkout.stripe.com/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Mock hosted checkout</h1>" }));
  const request = { shopName: "Dinner", totalAmount: 600, name: "Alex", share: 300 };
  await page.goto("/#join=" + encodeURIComponent(JSON.stringify(request)));
  const button = page.getByRole("button", { name: /Test R.*300[.,]00 with Stripe/ });
  await button.click(); await expect(page.getByRole("alert")).toContainText("Please retry checkout");
  await button.click(); await expect(page).toHaveURL(/https:\/\/checkout.stripe.com/);
  expect(requests[0].amount).toBe(30000); expect(requests[0].key).toBeTruthy(); expect(requests[1].key).toBe(requests[0].key);
});

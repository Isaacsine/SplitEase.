import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Stripe from "stripe";
import { stripeSandboxRoutes } from "../src/modules/payments/stripeSandbox.js";
import { readStripeConfig } from "../src/config/stripe.js";
const config = { enabled: true, secretKey: "sk_test_fake", webhookSecret: "whsec_test", appUrl: "http://127.0.0.1:5173" };
const stripe = new Stripe(config.secretKey);
const sample = { id: "cs_test_example", livemode: false, status: "open", payment_status: "unpaid", amount_total: 30000, currency: "zar", metadata: { integration: "splitease-sandbox-v1", payer_id: "payer-a" }, url: "https://checkout.stripe.com/c/pay/cs_test_example" };
async function fixture(enabled = true) {
  let session = { ...sample };
  const creates: { params: Stripe.Checkout.SessionCreateParams; key?: string }[] = [];
  const client = { webhooks: stripe.webhooks, checkout: { sessions: {
    create: async (params: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions) => { creates.push({ params, key: options.idempotencyKey }); return session; },
    retrieve: async () => session,
  } } } as unknown as Stripe;
  const app = express(); app.use("/api/stripe", stripeSandboxRoutes({ ...config, enabled }, client, async token => { if (!["payer-a", "payer-b"].includes(token)) throw new Error("Invalid token"); return token; }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw Error("No server address");
  return { base: `http://127.0.0.1:${address.port}/api/stripe`, creates, set: (changes: Partial<typeof sample>) => { session = { ...sample, ...changes }; }, close: () => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())) };
}
const authorized = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers); if (!headers.has("Authorization")) headers.set("Authorization", "Bearer payer-a");
  return fetch(url, { ...init, headers });
};
const body = (amountCents = 30000) => ({ method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "12345678-1234-1234-1234-123456789012", Authorization: "Bearer payer-a" }, body: JSON.stringify({ amountCents, currency: "usd", success_url: "https://attacker.example", status: "succeeded" }) });

test("sandbox configuration rejects live keys, missing webhook secrets and unsafe origins", () => {
  assert.equal(readStripeConfig({}).enabled, false);
  assert.throws(() => readStripeConfig({ STRIPE_SANDBOX_ENABLED: "true", STRIPE_SECRET_KEY: "sk_live_no" }), /Live keys/);
  assert.throws(() => readStripeConfig({ STRIPE_SANDBOX_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_fake" }), /WEBHOOK/);
  assert.throws(() => readStripeConfig({ STRIPE_SANDBOX_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_fake", APP_URL: "http://example.com" }), /APP_URL/);
});
test("disabled sandbox rejects requests", async () => {
  const f = await fixture(false); try { assert.equal((await fetch(f.base + "/checkout", body())).status, 503); } finally { await f.close(); }
});
test("creates ZAR hosted checkout with trusted return URLs and stable retry keys", async () => {
  const f = await fixture(); try {
    for (let i = 0; i < 2; i++) assert.equal((await fetch(f.base + "/checkout", body())).status, 201);
    assert.equal(f.creates[0].params.line_items![0].price_data!.unit_amount, 30000);
    assert.equal(f.creates[0].params.line_items![0].price_data!.currency, "zar");
    assert.equal(f.creates[0].params.success_url, config.appUrl + "/#stripe-return={CHECKOUT_SESSION_ID}");
    assert.deepEqual(f.creates[0].params.allowed_payment_method_types, ["card"]);
    assert.equal(f.creates[0].key, f.creates[1].key);
    for (const amount of [-1, 999, 10000001, 1234.5]) assert.equal((await fetch(f.base + "/checkout", body(amount))).status, 400);
    f.set({ livemode: true }); assert.equal((await fetch(f.base + "/checkout", body())).status, 502);
  } finally { await f.close(); }
});
test("status is retrieved from Stripe, not success query parameters", async () => {
  const f = await fixture(); try {
    let response = await authorized(f.base + "/sessions/cs_test_example?status=succeeded");
    assert.equal((await response.json()).status, "pending"); assert.equal(response.headers.get("cache-control"), "no-store");
    f.set({ status: "complete", payment_status: "paid" }); response = await authorized(f.base + "/sessions/cs_test_example"); assert.equal((await response.json()).status, "succeeded");
    f.set({ status: "expired" }); assert.equal((await (await authorized(f.base + "/sessions/cs_test_example")).json()).status, "expired");
    f.set({ livemode: true }); assert.equal((await authorized(f.base + "/sessions/cs_test_example")).status, 404);
    f.set({ metadata: { integration: "another-app", payer_id: "payer-a" } }); assert.equal((await authorized(f.base + "/sessions/cs_test_example")).status, 404);
    assert.equal((await authorized(f.base + "/sessions/cs_live_example")).status, 400);
  } finally { await f.close(); }
});
test("raw signed webhooks accept retries and reject missing signatures, tampering and live events", async () => {
  const f = await fixture(); try {
    const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", livemode: false, data: { object: { ...sample, status: "complete", payment_status: "paid" } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: config.webhookSecret });
    const send = (text: string, sig = signature) => fetch(f.base + "/webhook", { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": sig }, body: text });
    assert.equal((await send(payload)).status, 200); assert.equal((await send(payload)).status, 200);
    assert.equal((await send(payload, "bad")).status, 400); assert.equal((await send(payload + " ")).status, 400);
    const live = payload.replace('"livemode":false', '"livemode":true');
    assert.equal((await send(live, stripe.webhooks.generateTestHeaderString({ payload: live, secret: config.webhookSecret }))).status, 400);
  } finally { await f.close(); }
});

test("checkout and receipts reject anonymous callers and another payer", async () => {
 const f = await fixture(); try {
  assert.equal((await fetch(f.base + "/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({amountCents:30000}) })).status,401);
  assert.equal((await fetch(f.base + "/sessions/cs_test_example")).status,401);
  assert.equal((await authorized(f.base + "/sessions/cs_test_example", { headers: { Authorization: "Bearer payer-b" } })).status,404);
  assert.equal((await authorized(f.base + "/sessions/cs_test_example", { headers: { Authorization: "Bearer invalid" } })).status,401);
 } finally { await f.close(); }
});

import express, { Router } from "express";
import Stripe from "stripe";
import { readEnv } from "../../config/env.js";
import type { StripeSandboxConfig } from "../../config/stripe.js";

const integration = "splitease-sandbox-v1";
export function sandboxSession(session: Stripe.Checkout.Session) {
  if (session.livemode || !session.id.startsWith("cs_test_") || session.metadata?.integration !== integration) {
    throw new Error("This is not a SplitEase sandbox session.");
  }
  return {
    id: session.id,
    status: session.status === "complete" && session.payment_status === "paid" ? "succeeded" : session.status === "expired" ? "expired" : "pending",
    amountCents: session.amount_total,
    currency: session.currency?.toUpperCase(),
    sandbox: true,
  };
}

export function stripeSandboxRoutes(config: StripeSandboxConfig, client?: Stripe, authenticate?: (token: string) => Promise<string>) {
  const router = Router();
  if (!config.enabled) {
    router.use((_req, res) => res.status(503).json({ error: "Stripe sandbox is disabled. Configure the backend sandbox settings first." }));
    return router;
  }
  const stripe = client || new Stripe(config.secretKey!, { timeout: 15000, maxNetworkRetries: 1 });
  async function payer(authorization?: string) {
    const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return undefined;
    try {
      if (authenticate) return await authenticate(token);
      const env = readEnv();
      if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return undefined;
      const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
        headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return undefined;
      const user = await response.json() as { id?: string };
      return typeof user.id === "string" ? user.id : undefined;
    } catch { return undefined; }
  }

  // Stripe must receive the original bytes, before express.json parses the body.
  router.post("/webhook", express.raw({ type: "application/json", limit: "256kb" }), (req, res) => {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.header("Stripe-Signature") || "", config.webhookSecret!);
      if (event.livemode) throw new Error("Live events are rejected.");
    } catch {
      return res.status(400).json({ error: "Invalid sandbox webhook signature or event." });
    }
    if (["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      // Other checkouts in this sandbox do not belong to this integration.
      if (session.metadata?.integration === integration) {
        try {
          const result = sandboxSession(session);
          console.info(JSON.stringify({ event: event.type, eventId: event.id, sessionId: result.id, status: result.status, sandbox: true }));
        } catch { return res.status(400).json({ error: "Invalid sandbox session." }); }
      }
    }
    // No database mutation or fulfilment: retries are safe. Stripe is the durable
    // source of session status, retrieved server-side by the return page below.
    return res.json({ received: true });
  });
  router.use(express.json({ limit: "8kb" }));
  router.post("/checkout", async (req, res) => {
    const userId = await payer(req.header("Authorization"));
    if (!userId) return res.status(401).json({ error: "Sign in to use test checkout." });
    const { amountCents } = req.body || {};
    const key = req.header("Idempotency-Key");
    if (!Number.isSafeInteger(amountCents) || amountCents < 1000 || amountCents > 10_000_000 || !key || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) {
      return res.status(400).json({ error: "Use an amount from R10 to R100,000 and a valid Idempotency-Key." });
    }
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        allowed_payment_method_types: ["card"],
        line_items: [{ quantity: 1, price_data: { currency: "zar", unit_amount: amountCents, product_data: { name: "SplitEase sandbox contribution" } } }],
        metadata: { integration, payer_id: userId },
        payment_intent_data: { metadata: { integration } },
        success_url: `${config.appUrl}/#stripe-return={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.appUrl}/#stripe-return=cancelled`,
      }, { idempotencyKey: `splitease-sandbox-${userId}-${key}` });
      sandboxSession(session);
      if (session.metadata?.payer_id !== userId) throw new Error("Unexpected checkout owner.");
      const url = new URL(session.url || "");
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("Invalid checkout URL.");
      return res.status(201).json({ id: session.id, url: session.url, sandbox: true });
    } catch (error) {
      console.error("Stripe sandbox checkout failed", error instanceof Stripe.errors.StripeError ? error.type : "invalid_session");
      return res.status(502).json({ error: "Could not start Stripe sandbox checkout. Check the backend test key, amount and Stripe sandbox logs." });
    }
  });
  router.get("/sessions/:id", async (req, res) => {
    const userId = await payer(req.header("Authorization"));
    if (!userId) return res.status(401).json({ error: "Sign in to view your payment receipt." });
    res.setHeader("Cache-Control", "no-store");
    if (!/^cs_test_[a-zA-Z0-9]+$/.test(String(req.params.id))) return res.status(400).json({ error: "Invalid sandbox session ID." });
    try {
      const session = await stripe.checkout.sessions.retrieve(String(req.params.id));
      if (session.metadata?.payer_id !== userId) return res.status(404).json({ error: "Payment receipt not found." });
      return res.json(sandboxSession(session));
    } catch {
      return res.status(404).json({ error: "Sandbox session not found. Check that the backend uses the same sandbox account." });
    }
  });
  return router;
}

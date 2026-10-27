export type StripeSandboxConfig = { enabled: boolean; secretKey?: string; webhookSecret?: string; appUrl: string };
export function readStripeConfig(env: NodeJS.ProcessEnv = process.env): StripeSandboxConfig {
  const enabled = env.STRIPE_SANDBOX_ENABLED === "true";
  const appUrl = (env.APP_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
  if (enabled) {
    if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Stripe sandbox requires STRIPE_SECRET_KEY starting with sk_test_. Live keys are rejected.");
    if (!env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) throw new Error("Stripe sandbox requires STRIPE_WEBHOOK_SECRET from the Stripe CLI or sandbox webhook endpoint.");
    const url = new URL(appUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
      throw new Error("APP_URL must be your HTTPS frontend origin (or HTTP localhost for local testing).");
    }
  }
  return { enabled, appUrl, secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET };
}

import { readStripeConfig } from "./config/stripe.js";
import { stripeSandboxRoutes } from "./modules/payments/stripeSandbox.js";
import express, { type ErrorRequestHandler } from "express";
import { readEnv } from "./config/env.js";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const frontendDist = path.resolve(__dirname, "..", "..", "frontend", "dist");
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  const env = readEnv();
  const stripeConfig = readStripeConfig();
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", env.corsOrigin);
    res.header("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });
  app.use("/api/stripe", stripeSandboxRoutes(stripeConfig));
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/health", (_req, res) =>
    res.json({
      ok: true,
      mode: "test",
      paymentsEnabled: stripeConfig.enabled,
      gateway: stripeConfig.enabled ? "stripe" : "disabled",
      moneyMoves: false,
      persistence: env.persistence,
      stripeSandboxEnabled: stripeConfig.enabled,
    }),
  );
  // API routes that don't match return 404.
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Route not found." }),
  );
  app.use(express.static(frontendDist));
  app.get("/{*path}", (_req, res, next) => {
    res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
  const errors: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const candidate =
      typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : 500;
    const status = [400, 403, 404, 413].includes(candidate) ? candidate : 500;
    const message =
      status === 400
        ? "Invalid request body."
        : status === 413
          ? "Request is too large."
          : status === 404
            ? "Route not found."
            : "Could not complete the request.";
    return res.status(status).json({ error: message });
  };
  app.use(errors);
  return app;
}

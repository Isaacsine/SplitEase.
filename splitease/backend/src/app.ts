import express from "express";
import { readEnv } from "./config/env.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const frontendDist = path.resolve(__dirname, "..", "..", "frontend", "dist");
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  const env = readEnv();
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", env.corsOrigin);
    res.header("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/health", (_req, res) =>
    res.json({
      ok: true,
      mode: "mock",
      paymentsEnabled: true,
      gateway: "mock",
      moneyMoves: false,
      persistence: env.persistence,
    })
  );
  app.use("/api/payments", paymentsRoutes());
  // API routes that don't match return 404.
  app.use("/api", (_req, res) => res.status(404).json({ error: "Route not found." }));
  app.use(express.static(frontendDist));
  app.get("/{*path}", (_req, res, next) => {
    res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
  return app;
}

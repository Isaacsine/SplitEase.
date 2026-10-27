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
  // Non-API requests are for the frontend SPA. Serve index.html for the root
  // path and for client-side routing. For static assets (JS, CSS), serve them
  // directly from the frontend/dist directory.
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    // Serve static assets from frontend/dist. Strip leading slash from req.path
    // to avoid path resolution issues on Windows.
    const assetPath = req.path.replace(/^\/+/, "");
    const assetFullPath = path.resolve(__dirname, "..", "..", "frontend", "dist", assetPath);
    console.error("DEBUG: assetFullPath =", JSON.stringify(assetFullPath));
    res.sendFile(assetFullPath, (err: unknown) => {
      if (err) {
        console.error("sendFile error:", err);
      }
      if (err && typeof err === "object" && (err as NodeJS.ErrnoException).code === "ENOENT") {
        // File not found — serve index.html for client-side routing
        res.sendFile(path.join(frontendDist, "index.html"));
      } else {
        next(err);
      }
    });
  });
  return app;
}

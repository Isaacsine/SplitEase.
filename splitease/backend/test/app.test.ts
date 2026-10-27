import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
test("API errors are JSON and do not expose internal stacks", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No server address");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(base + "/api/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).moneyMoves, false);
    assert.equal((await fetch(base + "/api/payments/legacy-record")).status, 404);
    const malformed = await fetch(base + "/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), {
      error: "Invalid request body.",
    });
    const oversized = await fetch(base + "/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(40000) }),
    });
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), {
      error: "Request is too large.",
    });
    const missing = await fetch(base + "/api/missing");
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "Route not found." });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

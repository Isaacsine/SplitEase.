import { createApp } from "./app.js";
import { readEnv } from "./config/env.js";
const port = readEnv().port;
const server = createApp().listen(
  port,
  process.env.RENDER ? "0.0.0.0" : "127.0.0.1",
  () => console.log("SplitEase mock backend listening on port " + port),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => server.close(() => process.exit(0)));

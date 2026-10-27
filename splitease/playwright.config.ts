import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/legacy/**",
  fullyParallel: false,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:5175", channel: "msedge", headless: true },
  webServer: {
    command: "npm run dev --workspace frontend -- --port 5175 --strictPort",
    env: {
      VITE_STRIPE_SANDBOX_ENABLED: "true",
      VITE_API_URL: "",
      VITE_SUPABASE_URL: "https://splitease-tests.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
  },
  reporter: "list",
});

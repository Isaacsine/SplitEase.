import { test, expect, type Page } from "@playwright/test";
const phoneUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "phone@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: new Date().toISOString() };
const jwt = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: user.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + ".testsignature";
const session = { access_token: jwt, refresh_token: "phone-refresh", token_type: "bearer", expires_in: 3600, user };
async function mock(page: Page) {
  const state = { registrations: 0, authentications: 0, oauth: "" };
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (!url.hostname.endsWith(".supabase.co")) return route.continue();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (url.pathname === "/auth/v1/authorize") {
      state.oauth = url.href;
      const callback = new URL(url.searchParams.get("redirect_to")!);
      callback.hash = new URLSearchParams({ access_token: jwt, refresh_token: "phone-refresh", token_type: "bearer", expires_in: "3600" }).toString();
      return route.fulfill({ status: 302, headers: { location: callback.href } });
    }
    if (url.pathname === "/auth/v1/token") return json(session);
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/auth/v1/logout") return json({});
    const challenge = Buffer.from("a fresh test challenge for passkey").toString("base64url");
    if (url.pathname.endsWith("/passkeys/registration/options")) return json({ challenge_id: "registration", options: { challenge, rp: { id: "localhost", name: "SplitEase" }, user: { id: Buffer.from(user.id).toString("base64url"), name: user.email, displayName: "Phone user" }, pubKeyCredParams: [{ type: "public-key", alg: -7 }], authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" }, timeout: 10000, attestation: "none" } });
    if (url.pathname.endsWith("/passkeys/registration/verify")) { expect(route.request().postDataJSON().credential.response.attestationObject).toBeTruthy(); state.registrations++; return json({ id: "phone-passkey", created_at: new Date().toISOString() }); }
    if (url.pathname.endsWith("/passkeys/authentication/options")) return json({ challenge_id: "authentication", options: { challenge, rpId: "localhost", userVerification: "required", timeout: 10000 } });
    if (url.pathname.endsWith("/passkeys/authentication/verify")) { expect(route.request().postDataJSON().credential.response.signature).toBeTruthy(); state.authentications++; return json(session); }
    return json([]);
  });
  return state;
}
async function openSignIn(page: Page) { await page.goto("/"); await page.getByRole("button", { name: "Sign in", exact: true }).click(); }
async function capability(page: Page, available = true) {
  await page.addInitScript((value) => { PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => value; }, available);
}

test("laptops offer Google and hide phone sign-in even at phone width", async ({ page }) => {
  await capability(page); await page.setViewportSize({ width: 375, height: 812 }); await openSignIn(page);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with phone passkey" })).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill(user.email); await page.getByLabel("Password", { exact: true }).fill("test-password");
  await mock(page); await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enable phone sign-in" })).toHaveCount(0);
});

test("Google sign-in preserves session preference and returns to the original page", async ({ page }) => {
  const state = await mock(page); await page.goto("/#wallet"); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Keep me signed in", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible(); await expect(page).toHaveURL(/#wallet$/);
  expect(new URL(state.oauth).searchParams.get("provider")).toBe("google");
  expect(await page.evaluate(() => Object.keys(sessionStorage).some(k => /^sb-.*-auth-token$/.test(k)))).toBe(true);
});

test.describe("phone passkeys", () => {
  test.use({ baseURL: "http://localhost:5173", userAgent: phoneUA, viewport: { width: 390, height: 844 } });
  test("unsupported phones keep Google and password options", async ({ page }) => {
    await capability(page, false); await openSignIn(page);
    await expect(page.getByRole("button", { name: "Sign in with phone passkey" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });
  test("registers a phone credential and signs in after signing out", async ({ page }) => {
    const state = await mock(page); await capability(page);
    const cdp = await page.context().newCDPSession(page); await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await openSignIn(page); await expect(page.getByRole("button", { name: "Sign in with phone passkey" })).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(user.email); await page.getByLabel("Password", { exact: true }).fill("test-password");
    await page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Enable phone sign-in" }).click();
    await expect(page.getByRole("status")).toContainText("Phone sign-in is ready"); expect(state.registrations).toBe(1);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Sign in with phone passkey" }).click();
    await expect(page.getByRole("status")).toContainText("Signed in with your phone"); expect(state.authentications).toBe(1);
    await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
  test("cancelled verification leaves password sign-in available", async ({ page }) => {
    await mock(page); await capability(page);
    await page.addInitScript(() => { navigator.credentials.get = async () => { throw new DOMException("Cancelled", "NotAllowedError"); }; });
    await openSignIn(page); await page.getByRole("button", { name: "Sign in with phone passkey" }).click();
    await expect(page.getByRole("status")).toContainText(/cancelled|timed out/i);
    await expect(page.getByRole("dialog").getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Account", exact: true })).toHaveCount(0);
  });
});

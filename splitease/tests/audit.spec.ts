import { test, expect, type Page } from "@playwright/test";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "audit@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token = "22222222-2222-4222-8222-222222222222";
const jwt =
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ) +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url") +
  ".testsignature";
async function mockSupabase(page: Page) {
  const state = {
    inserts: 0,
    existing: false,
    failedList: false,
    expired: false,
  };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!url.hostname.endsWith(".supabase.co")) return route.continue();
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
        headers: { "access-control-allow-origin": "*" },
      });
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204 });
    if (url.pathname === "/auth/v1/token")
      return json({
        access_token: jwt,
        refresh_token: "audit-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/auth/v1/logout") return json({});
    if (url.pathname === "/auth/v1/signup")
      return json({ user, session: null });
    if (url.pathname.endsWith("/rpc/read_payment_request"))
      return json(
        state.expired
          ? []
          : [
              {
                id: token,
                title: "Dinner",
                recipient_name: "Alex",
                amount_cents: 30000,
                total_cents: 60000,
                expires_at: new Date(Date.now() + 86400000).toISOString(),
              },
            ],
      );
    if (url.pathname === "/rest/v1/payment_requests") {
      if (route.request().method() === "POST") {
        state.inserts++;
        state.existing = true;
        return json({ token });
      }
      if (url.searchParams.get("select") === "token")
        return json(state.existing ? [{ token }] : []);
      if (state.failedList) return json({ message: "Query failed" }, 400);
      return json([
        {
          id: token,
          token,
          title: "Dinner",
          recipient_name: "Alex",
          amount_cents: 30000,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);
    }
    return json({ message: "Unexpected audit endpoint" }, 400);
  });
  return state;
}
async function setup(page: Page) {
  await page.goto("/");
  await page.getByLabel("Split name").fill("Dinner");
  await page.getByLabel("Total to split").fill("600");
  await page
    .getByRole("button", { name: "+ Add a person", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Add person", exact: true }).click();
}
async function login(page: Page) {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("audit@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your account" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
}
test("all navigation links, participant removal, dialog close, category and split summary", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("What is it for?").selectOption("Rent & bills");
  await page.getByRole("button", { name: "Remove Alex" }).click();
  await expect(page.locator(".person")).toHaveCount(1);
  await page.getByRole("button", { name: "Your split" }).click();
  await expect(page.getByRole("dialog")).toContainText("Dinner");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await expect(page.getByRole("alert")).toContainText("at least two people");
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your activity" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("link", { name: "Create a split", exact: true }).click();
  await page.getByRole("link", { name: "Scan to pay", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scan to pay", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "SplitEase", exact: true }).click();
  await expect(page.getByLabel("Split name")).toHaveValue("Dinner");
});
test("fractional cents, zero totals, and invalid percentages are rejected", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("Total to split").fill("0");
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a total");
  await page.getByLabel("Total to split").fill("600.001");
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await expect(page.getByRole("alert")).toContainText("two decimal places");
  await page.getByLabel("Total to split").fill("600");
  await page.getByRole("button", { name: "By amount", exact: true }).click();
  await page.getByLabel("You share").fill("300.001");
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await expect(page.getByRole("alert")).toContainText("two decimal places");
  await page.getByRole("button", { name: "By %", exact: true }).click();
  await page.getByLabel("You percentage").fill("80");
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await expect(page.getByRole("alert")).toContainText("100%");
});
test("copy, share fallback, email and WhatsApp links, QR reveal, open request and new split", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as any).auditClipboard = text;
        },
      },
      configurable: true,
    });
  });
  await page.goto("/");
  await page.getByLabel("Split name").fill("Gift");
  await page.getByLabel("Total to split").fill("200");
  await page
    .getByRole("button", { name: "+ Add a person", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Email friend");
  await page.getByLabel("How should they join?").selectOption("email");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("friend@example.test");
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await page.getByRole("button", { name: "Create payment invites" }).click();
  const id = await page
    .getByLabel("Choose a participant")
    .locator("option")
    .filter({ hasText: "Email friend" })
    .getAttribute("value");
  await page.getByLabel("Choose a participant").selectOption(id!);
  await expect(
    page.getByRole("link", { name: "Email invite", exact: true }),
  ).toHaveAttribute("href", /mailto:friend%40example.test/);
  await expect(
    page.getByRole("link", { name: "WhatsApp", exact: true }),
  ).toHaveAttribute("href", /wa.me/);
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Link copied.");
  const link = await page.getByLabel("Invite link").inputValue();
  expect(await page.evaluate(() => (window as any).auditClipboard)).toBe(link);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  expect(await page.evaluate(() => (window as any).auditClipboard)).toBe(link);
  await page.getByText("Show invitation QR code", { exact: true }).click();
  await expect(
    page.getByAltText("Invitation QR for Email friend"),
  ).toBeVisible();
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Open request", exact: true }).click();
  const request = await popup;
  await expect(
    request.getByRole("heading", {
      name: "Hi Email friend, here is your share.",
    }),
  ).toBeVisible();
  await request.close();
  await page.getByRole("button", { name: "Back to edit split" }).click();
  await expect(page.getByLabel("Split name")).toHaveValue("Gift");
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await page.getByRole("button", { name: "Start a new split" }).click();
  await expect(page.getByLabel("Split name")).toHaveValue("");
});
test("native sharing sends the invitation once without a repeated URL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: async (data: unknown) => {
        (window as any).shared = data;
      },
      configurable: true,
    });
  });
  await setup(page);
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const shared = await page.evaluate(() => (window as any).shared);
  expect(shared.text.match(/#join=/g)).toHaveLength(1);
  expect(shared.url).toBeUndefined();
});
test("Supabase sign-in, tracked invitation reuse, activity open/retry, and sign-out (mocked responses)", async ({
  page,
}) => {
  const state = await mockSupabase(page);
  await setup(page);
  await login(page);
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await page.getByRole("button", { name: "Create tracked invitation" }).click();
  await expect(page.getByLabel("Invite link")).toHaveValue(
    new RegExp("#invite=" + token),
  );
  expect(state.inserts).toBe(1);
  await page.getByRole("button", { name: "Back to edit split" }).click();
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await page.getByRole("button", { name: "Create tracked invitation" }).click();
  await expect(
    page.getByText("Tracked request", { exact: true }),
  ).toBeVisible();
  expect(state.inserts).toBe(1);
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.locator("article.person")).toHaveCount(1);
  await page.getByRole("link", { name: "Open request", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hi Alex, here is your share." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Preview payment of/ }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  state.failedList = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not load");
  state.failedList = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("article.person")).toHaveCount(1);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.locator("article.person")).toHaveCount(0);
});
test("sign-up confirmation and expired tracked invitation states (mocked responses)", async ({
  page,
}) => {
  const state = await mockSupabase(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "New here? Create an account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("audit@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page
    .getByRole("button", {
      name: "Already have an account? Sign in",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  state.expired = true;
  await page.goto("/#invite=" + token);
  await expect(
    page.getByRole("heading", { name: "This invite is unavailable." }),
  ).toBeVisible();
  await expect(page.getByText(/invalid or has expired/)).toBeVisible();
});
test("scanner handles malformed and oversized images and manual request review", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Create payment invites" }).click();
  const link = await page.getByLabel("Invite link").inputValue();
  await page.goto("/#scan");
  await page.getByLabel("Upload QR image", { exact: true }).setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("No readable QR code");
  await page.getByLabel("Upload QR image", { exact: true }).setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert")).toContainText("smaller than 10 MB");
  await page.getByLabel("Or paste a payment link or QR content").fill(link);
  await page.getByRole("button", { name: "Read payment request" }).click();
  await page.getByRole("button", { name: "Review request" }).click();
  await expect(
    page.getByRole("heading", { name: "Hi You, here is your share." }),
  ).toBeVisible();
});

test("camera start, stop and navigation release the media stream (synthetic camera)", async ({
  playwright,
}) => {
  const browser = await playwright.chromium.launch({
    channel: "msedge",
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const context = await browser.newContext({ permissions: ["camera"] });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:5173/#scan");
    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(
      page.getByRole("button", { name: "Stop camera" }),
    ).toBeVisible();
    await page.evaluate(() => {
      (window as any).auditStream = (
        document.querySelector("video") as HTMLVideoElement
      ).srcObject;
    });
    await page.getByRole("button", { name: "Stop camera" }).click();
    expect(
      await page.evaluate(() =>
        (window as any).auditStream
          .getTracks()
          .every((t: MediaStreamTrack) => t.readyState === "ended"),
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(
      page.getByRole("button", { name: "Stop camera" }),
    ).toBeVisible();
    await page.evaluate(() => {
      (window as any).auditStream = (
        document.querySelector("video") as HTMLVideoElement
      ).srcObject;
    });
    await page.getByRole("link", { name: "Split", exact: true }).click();
    expect(
      await page.evaluate(() =>
        (window as any).auditStream
          .getTracks()
          .every((t: MediaStreamTrack) => t.readyState === "ended"),
      ),
    ).toBe(true);
  } finally {
    await browser.close();
  }
});

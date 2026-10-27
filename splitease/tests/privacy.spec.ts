import { test, expect } from "@playwright/test";
import { signedInTestAccount } from "./helpers/session";
test("account drafts stay isolated across sign-out and account switches", async ({
  page,
}) => {
  const users = {
    a: "11111111-1111-4111-8111-111111111111",
    b: "22222222-2222-4222-8222-222222222222",
  };
  let current = "a" as "a" | "b";
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!url.hostname.endsWith(".supabase.co")) return route.continue();
    const user = {
      id: users[current],
      email: current + "@example.test",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    const jwt =
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ) +
      "." +
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url") +
      ".test";
    const json = (body: unknown) => route.fulfill({ json: body });
    if (url.pathname === "/auth/v1/token")
      return json({
        access_token: jwt,
        refresh_token: "refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/auth/v1/logout") return json({});
    return json([]);
  });
  const login = async () => {
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByLabel("Email", { exact: true })
      .fill(current + "@example.test");
    await page.getByLabel("Password", { exact: true }).fill("test-password");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Account", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  };
  const logout = async () => {
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByLabel("Split name")).toHaveValue("");
  };
  await page.goto("/");
  await login();
  await page.getByLabel("Split name").fill("Private account A");
  await logout();
  current = "b";
  await login();
  await expect(page.getByLabel("Split name")).toHaveValue("");
  await page.getByLabel("Split name").fill("Private account B");
  await logout();
  current = "a";
  await login();
  await expect(page.getByLabel("Split name")).toHaveValue("Private account A");
});
test("anonymous checkout requests sign-in instead of creating a transaction", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/stripe/checkout", (route) => {
    calls++;
    return route.abort();
  });
  await page.goto(
    "/#join=" +
      encodeURIComponent(
        JSON.stringify({
          shopName: "Dinner",
          totalAmount: 600,
          name: "Alex",
          share: 300,
        }),
      ),
  );
  await page.getByRole("button", { name: /Test R.*with Stripe/ }).click();
  await expect(page).toHaveURL(/#account$/);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  expect(calls).toBe(0);
});
test("legacy local test balances and payment events are permanently cleared", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "splitease-wallet-v1",
      JSON.stringify({ balance: 50000, entries: [{ cents: 50000 }] }),
    );
    localStorage.setItem(
      "splitease-demo-rooms-v1",
      JSON.stringify({
        room: {
          completed: true,
          members: [{ state: "covered", repaid: 1 }],
          events: [{ action: "created" }, { action: "pay" }],
        },
      }),
    );
  });
  await page.goto("/");
  const data = await page.evaluate(() => ({
    wallet: localStorage.getItem("splitease-wallet-v1"),
    room: JSON.parse(localStorage.getItem("splitease-demo-rooms-v1")!).room,
  }));
  expect(data.wallet).toBeNull();
  expect(data.room.completed).toBe(false);
  expect(data.room.members[0].state).toBe("pending");
  expect(data.room.events).toEqual([{ action: "created" }]);
});
test("private photos use authorized short-lived URLs instead of public URLs", async ({
  page,
}) => {
  await signedInTestAccount(page);
  let ttl = 0;
  await page.route("**/rest/v1/rpc/private_schema_version", (route) =>
    route.fulfill({ json: 1 }),
  );
  await page.route("**/rest/v1/rpc/read_group_room", (route) =>
    route.fulfill({ json: { key: "room", members: [] } }),
  );
  await page.route("**/rest/v1/rpc/list_group_room_photos", (route) =>
    route.fulfill({
      json: [
        {
          id: "photo",
          storagePath: "room/private.jpg",
          fileName: "private.jpg",
          uploaderName: "Owner",
          mimeType: "image/jpeg",
          sizeBytes: 100,
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  );
  await page.route("**/storage/v1/object/sign/group-photos", (route) => {
    ttl = route.request().postDataJSON().expiresIn;
    return route.fulfill({
      json: [
        {
          path: "room/private.jpg",
          signedURL: "/object/sign/group-photos/room/private.jpg?token=test",
        },
      ],
    });
  });
  await page.goto("/#help");
  const photos = await page.evaluate(async () => {
    const { listRoomPhotos } =
      await import("/src/features/rooms/roomPhotos.api.ts");
    return listRoomPhotos({ key: "room", mode: "cloud" });
  });
  expect(photos[0].url).toContain("/object/sign/");
  expect(photos[0].url).not.toContain("/object/public/");
  expect(ttl).toBe(300);
});

test("cloud sharing fails closed until the privacy migration is installed", async ({
  page,
}) => {
  await signedInTestAccount(page);
  let reads = 0;
  await page.route("**/rest/v1/rpc/private_schema_version", (route) =>
    route.fulfill({ status: 404, json: { message: "missing migration" } }),
  );
  await page.route("**/rest/v1/rpc/read_group_room", (route) => {
    reads++;
    return route.fulfill({ json: { members: [] } });
  });
  await page.goto("/#help");
  const message = await page.evaluate(async () => {
    try {
      const { readRoom } = await import("/src/features/rooms/rooms.api.ts");
      await readRoom({ key: "room", mode: "cloud" });
      return "unexpected access";
    } catch (error) {
      return (error as Error).message;
    }
  });
  expect(message).toContain("Private sharing is being updated");
  expect(reads).toBe(0);
});

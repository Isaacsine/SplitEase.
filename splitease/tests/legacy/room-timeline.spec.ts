import { test, expect } from "@playwright/test";
test("history syncs, persists, identifies the actor and records joins once", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const api = await import("/src/features/rooms/rooms.api.ts");
    const ref = api.createGuidedRoom();
    location.hash = "room=" + ref.key + "&mode=demo";
  });
  const timeline = page.getByRole("region", {
    name: "Group activity timeline",
  });
  await expect(
    timeline.getByText("Organiser created the room.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Participant link", { exact: true })
    .selectOption({ label: "Alex" });
  const guest = await context.newPage();
  await guest.goto(
    await page.getByLabel("Participant link to share").inputValue(),
  );
  await expect(
    timeline.getByText("Alex joined through their participant link."),
  ).toBeVisible();
  await guest.reload();
  await expect(guest.getByLabel("Alex room payment choice")).toBeEnabled();
  await guest.getByLabel("Alex room payment choice").selectOption("cash");
  await expect(
    timeline.getByText("Alex changed Alex's choice to Cash."),
  ).toBeVisible();
  await guest
    .getByRole("button", { name: "Declare cash for Alex", exact: true })
    .click();
  await expect(
    timeline.getByText(
      "Alex declared cash for Alex; awaiting organiser confirmation.",
    ),
  ).toBeVisible();
  await expect(
    guest.getByText("Waiting for cash confirmation from the organiser.", {
      exact: false,
    }),
  ).toBeVisible();
  const before = await timeline.locator("li").count();
  const denied = await guest.evaluate(async () => {
    const api = await import("/src/features/rooms/rooms.api.ts");
    const model = await import("/src/features/rooms/rooms.ts");
    const ref = model.parseRoom(location.hash)!;
    const room = await api.readRoom(ref);
    try {
      await api.updateRoom(ref, room.members.find((m) => m.isMe)!.id, "cash");
      return false;
    } catch {
      return true;
    }
  });
  expect(denied).toBe(true);
  expect(await timeline.locator("li").count()).toBe(before);
  await page.getByRole("button", { name: "Confirm cash from Alex" }).click();
  await expect(
    guest
      .getByRole("region", { name: "Group activity timeline" })
      .getByText("Organiser confirmed cash from Alex (simulation)."),
  ).toBeVisible();
  await page.reload();
  await expect(
    timeline.getByText("Alex joined through their participant link."),
  ).toHaveCount(1);
  await expect(
    timeline.getByText("Organiser confirmed cash from Alex (simulation)."),
  ).toBeVisible();
  const times = await timeline
    .locator("time")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("datetime")));
  expect(times.every((t) => Number.isFinite(Date.parse(t!)))).toBe(true);
});
test("completed demo shows coverage, mixed choices and outstanding repayment plan", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const api = await import("/src/features/rooms/rooms.api.ts");
    const ref = api.createGuidedRoom();
    location.hash = "room=" + ref.key + "&mode=demo";
  });
  await page
    .getByRole("button", { name: "Record contribution for Alex" })
    .click();
  await page
    .getByRole("button", { name: "Use instalments for Lerato" })
    .click();
  await page.getByRole("button", { name: "Confirm cash from You" }).click();
  await page.getByRole("button", { name: "Complete split" }).click();
  const outcome = page.getByRole("region", { name: "Split outcome" });
  await expect(outcome).toContainText("Split complete");
  await expect(outcome).toContainText(
    "3 payment choices; 1 repayment plans still active.",
  );
  await expect(
    page.getByRole("region", { name: "Group activity timeline" }),
  ).toContainText("Organiser completed the split (simulation).");
});

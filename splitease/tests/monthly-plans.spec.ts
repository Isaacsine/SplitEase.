import { test, expect, type Page } from "@playwright/test";
async function create(page: Page, kind = "savings") {
  await page.clock.install({ time: new Date("2027-01-15T10:00:00Z") });
  await page.goto("/#plans");
  await page.getByRole("button", { name: "New plan", exact: true }).click();
  if (kind === "savings")
    await page
      .getByRole("button", { name: "Savings goal", exact: false })
      .click();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill(kind === "savings" ? "Holiday, savings" : "Monthly rent");
  if (kind === "savings")
    await page.getByLabel("Group savings target (R)").fill("6000");
  await page.getByLabel("Monthly due day").fill("10");
  await page.getByLabel("Person 2", { exact: true }).fill("Alex");
  await page.getByLabel("Where to save").selectOption("local");
  await page.getByRole("button", { name: "Create plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Monthly agreements" }),
  ).toBeVisible();
}
async function openAlex(page: Page, context: any) {
  await page
    .getByLabel("Participant", { exact: true })
    .selectOption({ label: "Alex" });
  const guest = await context.newPage();
  await guest.clock.install({ time: new Date("2027-01-15T10:00:00Z") });
  await guest.goto(await page.getByLabel("Plan participant link").inputValue());
  await expect(
    guest.getByRole("heading", { name: "Monthly agreements" }),
  ).toBeVisible();
  return guest as Page;
}
test("agreements, private reminder preferences, confirmation and independent monthly debt", async ({
  page,
  context,
}) => {
  await create(page);
  await expect(
    page.getByRole("button", { name: "Start monthly plan" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Accept my contribution" }).click();
  const guest = await openAlex(page, context);
  const denied = await page.evaluate(async () => {
    const api = await import("/src/features/plans/plans.api.ts"),
      m = await import("/src/features/plans/plans.ts"),
      r = m.parsePlan(location.hash)!;
    const p = await api.readPlan(r);
    try {
      await api.changePlan(r, "accept", p.members[1].id, undefined, {
        revision: 1,
      });
      return false;
    } catch {
      return true;
    }
  });
  expect(denied).toBe(true);
  await guest.getByRole("button", { name: "Accept my contribution" }).click();
  await expect(
    page.getByRole("button", { name: "Start monthly plan" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start monthly plan" }).click();
  await guest.getByLabel("How you want to pay").selectOption("manual");
  await expect(guest.getByRole("option", { name: /Automatic debit/ })).toHaveCount(0);
  await guest.getByRole("button", { name: "Save preferences" }).click();
  await guest.reload();
  await expect(guest.getByLabel("How you want to pay")).toHaveValue(
    "manual",
  );
  const privateData = await page.evaluate(async () => {
    const api = await import("/src/features/plans/plans.api.ts"),
      m = await import("/src/features/plans/plans.ts");
    return (await api.readPlan(m.parsePlan(location.hash)!)).members[1];
  });
  expect(privateData.method).toBeUndefined();
  expect(privateData.reminders).toBeUndefined();
  await page.clock.setFixedTime(new Date("2027-02-15T10:00:00Z"));
  await guest.clock.setFixedTime(new Date("2027-02-15T10:00:00Z"));
  await page.reload();
  await guest.reload();
  await page.getByLabel("Month", { exact: true }).selectOption("2027-02");
  await guest.getByRole("button", { name: "I have paid for 2027-02" }).click();
  await expect(
    page.locator(".plan-period").filter({ hasText: "Alex" }),
  ).toContainText("Awaiting confirmation");
  const forbidden = await guest.evaluate(async () => {
    const api = await import("/src/features/plans/plans.api.ts"),
      m = await import("/src/features/plans/plans.ts"),
      r = m.parsePlan(location.hash)!,
      p = await api.readPlan(r);
    try {
      await api.changePlan(
        r,
        "confirm",
        undefined,
        p.periods.find(
          (x) =>
            x.memberId === p.members.find((m) => m.isMe)!.id &&
            x.month === "2027-02",
        )!.id,
      );
      return false;
    } catch {
      return true;
    }
  });
  expect(forbidden).toBe(true);
  await page.getByRole("button", { name: "Confirm Alex for 2027-02" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Savings progress" }),
  ).toHaveAttribute("value", "50000");
  await page.getByLabel("Month", { exact: true }).selectOption("2027-01");
  await expect(
    page.locator(".plan-period").filter({ hasText: "Alex" }),
  ).toContainText("Overdue");
  await guest.getByRole("link", { name: "All plans", exact: false }).click();
  await expect(
    guest.getByRole("region", { name: "Contribution reminders" }),
  ).toContainText("Overdue");
});
test("new amounts need acceptance, apply in future and preserve existing monthly records", async ({
  page,
  context,
}) => {
  await create(page, "expense");
  await page.getByRole("button", { name: "Accept my contribution" }).click();
  const guest = await openAlex(page, context);
  await guest.getByRole("button", { name: "Accept my contribution" }).click();
  await page.getByRole("button", { name: "Start monthly plan" }).click();
  await page.getByText("Change amount for Alex", { exact: true }).click();
  await page.getByLabel("New monthly amount for Alex (R)").fill("750");
  await page
    .locator(".plan-agreement")
    .filter({ hasText: "Alex" })
    .getByRole("button", { name: "Review amount change" })
    .click();
  await page.getByRole("button", { name: "Send new proposal" }).click();
  await expect(
    guest.getByRole("button", { name: "Accept my contribution" }),
  ).toBeVisible();
  await expect(
    page.locator(".plan-period").filter({ hasText: "Alex" }),
  ).toContainText("500,00");
  await guest.getByRole("button", { name: "Accept my contribution" }).click();
  await expect(
    page.locator(".plan-agreement").filter({ hasText: "Alex" }),
  ).toContainText("Accepted");
  await page.getByLabel("Month", { exact: true }).selectOption("2027-02");
  await expect(
    page.locator(".plan-period").filter({ hasText: "Alex" }),
  ).toContainText("750,00");
  await page.getByLabel("Month", { exact: true }).selectOption("2027-01");
  await expect(
    page.locator(".plan-period").filter({ hasText: "Alex" }),
  ).toContainText("500,00");
});
test("calendar has twelve clamped dates, escaped text, alarms and reminder opt-out", async ({
  page,
}) => {
  await create(page);
  const data = await page.evaluate(async () => {
    const m = await import("/src/features/plans/plans.ts"),
      api = await import("/src/features/plans/plans.api.ts"),
      p = await api.readPlan(m.parsePlan(location.hash)!);
    p.day = 31;
    return {
      ical: m.calendar(p),
      feb: m.dueDate("2027-02", 31),
      leap: m.dueDate("2028-02", 31),
    };
  });
  expect(data.feb).toBe("2027-02-28");
  expect(data.leap).toBe("2028-02-29");
  expect(data.ical.match(/BEGIN:VEVENT/g)).toHaveLength(12);
  expect(data.ical).toContain("DTSTART:20270228T070000Z");
  expect(data.ical).toContain(
    "Holiday" + String.fromCharCode(92) + ", savings",
  );
  expect(data.ical).toContain("TRIGGER:-P3D");
  await page.getByLabel("Remind me about contributions").uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.reload();
  await expect(
    page.getByLabel("Remind me about contributions"),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Export calendar reminders" }),
  ).toBeDisabled();
});
for (const width of [320, 768, 1366])
  test("plans fit " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await create(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const tiny = await page.locator("button,nav a,summary").evaluateAll((es) =>
      es
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5)
          );
        })
        .map((e) => e.textContent),
    );
    expect(tiny).toEqual([]);
  });

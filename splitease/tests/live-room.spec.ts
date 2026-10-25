import { test, expect } from "@playwright/test";
test("participant choices sync to organiser, cash needs confirmation, and credit survives completion", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const api = await import("/src/features/rooms/rooms.api.ts");
    const ref = api.createGuidedRoom();
    location.hash = "room=" + ref.key + "&mode=demo";
  });
  await expect(
    page.getByRole("progressbar", { name: "Bill coverage" }),
  ).toHaveAttribute("value", "0");
  await page
    .getByLabel("Participant link", { exact: true })
    .selectOption({ label: "Lerato" });
  const link = await page.getByLabel("Participant link to share").inputValue();
  const guest = await context.newPage();
  await guest.goto(link);
  await expect(guest.getByLabel("Alex room payment choice")).toBeDisabled();
  await expect(guest.getByRole("button", { name: /Confirm cash/ })).toHaveCount(
    0,
  );
  await guest
    .getByRole("button", { name: "Use instalments for Lerato" })
    .click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "40000");
  await page
    .getByRole("button", { name: "Record contribution for Alex" })
    .click();
  await page
    .getByRole("button", { name: "Declare cash for You", exact: true })
    .click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "80000");
  await expect(
    page.getByRole("button", { name: "Complete split" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Confirm cash from You" }).click();
  await expect(guest.getByRole("progressbar")).toHaveAttribute(
    "value",
    "120000",
  );
  await page.getByRole("button", { name: "Complete split" }).click();
  await expect(guest.getByLabel("Lerato room payment choice")).toBeDisabled();
  await expect(guest.getByText(/Remaining illustrative credit:/)).toContainText(
    "266,66",
  );
  await guest
    .getByRole("button", { name: "Record repayment for Lerato" })
    .click();
  await expect(page.getByText(/Remaining illustrative credit:/)).toContainText(
    "133,33",
  );
  await guest.getByRole("link", { name: "My balances", exact: true }).click();
  await expect(
    guest.getByText("133,33", { exact: false }).first(),
  ).toBeVisible();
});
test("reviewed receipt assigns exact shares and requires all items assigned", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "+ Add a person", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await page
    .getByRole("link", { name: "Start with a receipt", exact: false })
    .click();
  await page
    .getByLabel("Receipt text - review or paste manually")
    .fill(
      "Pizza platter 450.00\nPasta platter 350.00\nDesserts 200.00\nDrinks 200.00\nTOTAL 1200.00",
    );
  await page.getByRole("button", { name: "Extract items from text" }).click();
  await page
    .getByRole("button", { name: "Apply item shares to split" })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByRole("button", { name: "Share every item with everyone" })
    .click();
  await page
    .getByRole("button", { name: "Apply item shares to split" })
    .click();
  await expect(page.getByLabel("Total to split")).toHaveValue("1200");
});
for (const width of [320, 768, 1366])
  test("new pages fit " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(async () => {
      const api = await import("/src/features/rooms/rooms.api.ts");
      const ref = api.createGuidedRoom();
      location.hash = "room=" + ref.key + "&mode=demo";
    });
    for (const route of ["", "#balances", "#receipt"]) {
      if (route) await page.goto("/" + route);
      await expect(page.locator(".panel").first()).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
  });

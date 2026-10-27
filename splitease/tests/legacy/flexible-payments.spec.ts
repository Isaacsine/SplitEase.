import { test, expect } from "@playwright/test";
async function split(page: any) {
  await page.goto("/");
  await page.getByLabel("Split name").fill("Friends weekend");
  await page.getByLabel("Total to split").fill("900");
  for (const name of ["Alex", "Lerato"]) {
    await page
      .getByRole("button", { name: "+ Add a person", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Add person", exact: true }).click();
  }
}
test("expense workspace replaces the standalone funding simulator", async ({
  page,
}) => {
  await split(page);
  await expect(
    page.getByRole("heading", { name: "Expense details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create group", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Preview upfront payments & credit funding",
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/hackathon|judge walkthrough|guided demo/i),
  ).toHaveCount(0);
});

test("recipient receives an instalment suggestion and repays the illustrative balance", async ({
  page,
}) => {
  await split(page);
  await page.getByLabel("Lerato payment choice").selectOption("instalments");
  await page.getByRole("button", { name: "Create payment invites" }).click();
  const id = await page
    .getByLabel("Choose a participant")
    .locator("option")
    .filter({ hasText: "Lerato" })
    .getAttribute("value");
  await page.getByLabel("Choose a participant").selectOption(id!);
  const link = await page.getByLabel("Invite link").inputValue();
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Pay in instalments", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table")).toContainText(
    "Illustrative repayment schedule",
  );
  await page.getByRole("button", { name: "Preview credit approval" }).click();
  await expect(page.getByTestId("remaining-credit")).toHaveText("R 200,00");
  await page.getByRole("button", { name: "Preview next repayment" }).click();
  await expect(page.getByTestId("remaining-credit")).toHaveText("R 100,00");
  await page.getByRole("button", { name: "Preview next repayment" }).click();
  await expect(page.getByTestId("remaining-credit")).toHaveText("R 0,00");
  await expect(
    page.getByText("Illustrative credit balance cleared."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview cash received", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No real receipt has been recorded",
  );
});
test("repayment schedules sum to exact cents and clamp month-end dates", async ({
  page,
}) => {
  await page.goto("/");
  const plans = await page.evaluate(async () => {
    const path = "/src/features/payments/paymentPlans.ts";
    const { repaymentPlan } = await import(path);
    return {
      three: repaymentPlan(100, 3, "2026-01-31"),
      four: repaymentPlan(100.01, 4, "2026-01-31"),
      tiny: repaymentPlan(0.02, 3, "2026-01-31"),
    };
  });
  expect(plans.three.map((p: any) => p.amount)).toEqual([33.34, 33.33, 33.33]);
  expect(plans.three.map((p: any) => p.due)).toEqual([
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
  ]);
  expect(
    plans.four.reduce((s: number, p: any) => s + Math.round(p.amount * 100), 0),
  ).toBe(10001);
  expect(plans.tiny).toEqual([]);
});
test("four-payment choice survives reload and small shares cannot create a repayment preview", async ({
  page,
}) => {
  await split(page);
  await page.getByLabel("You payment choice").selectOption("instalments");
  await page.getByLabel("You number of instalments").selectOption("4");
  await page.reload();
  await expect(page.getByLabel("You payment choice")).toHaveValue(
    "instalments",
  );
  await expect(page.getByLabel("You number of instalments")).toHaveValue("4");
  const data = {
    shopName: "Small split",
    totalAmount: 0.04,
    name: "Alex",
    share: 0.02,
    paymentChoice: "instalments",
    instalmentCount: 3,
  };
  await page.goto("/#join=" + encodeURIComponent(JSON.stringify(data)));
  await expect(page.getByRole("alert")).toContainText("too small");
  await expect(
    page.getByRole("button", { name: "Preview credit approval" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Preview payment of/ }),
  ).toBeEnabled();
});
test("mobile instalment preview has no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const data = {
    shopName: "Trip",
    totalAmount: 1000,
    name: "Alex",
    share: 333.34,
    paymentChoice: "instalments",
    instalmentCount: 4,
  };
  await page.goto("/#join=" + encodeURIComponent(JSON.stringify(data)));
  await expect(page.getByRole("table")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

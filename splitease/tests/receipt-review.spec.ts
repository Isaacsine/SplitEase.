import { test, expect } from "@playwright/test";
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

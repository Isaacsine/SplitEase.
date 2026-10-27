import { test, expect } from "@playwright/test";
import QRCode from "qrcode";
async function startSplit(page: any) {
  await page.goto("/");
  await page.getByLabel("Split name").fill("Weekend trip");
  await page.getByLabel("Total to split").fill("1000");
  await addPerson(page, "Lerato");
  await addPerson(page, "Thabo");
}
async function addPerson(page: any, name: string) {
  await page
    .getByRole("button", { name: "+ Add a person", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Add person", exact: true }).click();
}
test("general purpose splits calculate cents and preserve drafts", async ({
  page,
}) => {
  await startSplit(page);
  await expect(page.getByText("Interactive demo")).toHaveCount(0);
  await expect(page.locator(".person .share").first()).toHaveText(/333[.,]34/);
  await page.getByRole("button", { name: "By %", exact: true }).click();
  await page.getByLabel("You percentage").fill("50");
  await page.getByLabel("Lerato percentage").fill("30");
  await page.getByLabel("Thabo percentage").fill("20");
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await expect(
    page.getByRole("heading", { name: "Your split is ready to share." }),
  ).toBeVisible();
  await expect(page.locator(".person .share").first()).toHaveText(/500[.,]00/);
  await page.reload();
  await expect(page.getByLabel("Split name")).toHaveValue("Weekend trip");
  await expect(page.locator(".person")).toHaveCount(3);
});
test("custom shares are validated and no local fake payment can be made", async ({
  page,
}) => {
  await startSplit(page);
  await page.getByRole("button", { name: "By amount", exact: true }).click();
  await page.getByLabel("You share").fill("1");
  await page.getByRole("button", { name: "Create payment invites" }).click();
  await expect(page.getByRole("alert")).toContainText("Shares must add up");
  await page.getByRole("button", { name: "Equally", exact: true }).click();
  await page.getByRole("button", { name: "Create payment invites" }).click();
  const link = await page.getByLabel("Invite link").inputValue();
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: /Test R.*with Stripe/ }),
  ).toBeEnabled();
  await expect(
    page.getByText("Your contribution", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/untracked request/i)).toBeVisible();
});
test("bank-linked cellphone invitations validate contacts and keep details out of links and storage", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Split name").fill("Dinner");
  await page.getByLabel("Total to split").fill("600");
  await page
    .getByRole("button", { name: "+ Add a person", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Alex");
  await page.getByLabel("How should they join?").selectOption("phone");
  await page.getByLabel("Cellphone number", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("9 to 15 digits");
  await page.getByLabel("Cellphone number", { exact: true }).fill("0821234567");
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(
    page.getByText("Bank-linked phone - unverified", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create payment invites" }).click();
  const alexId = await page
    .getByLabel("Choose a participant")
    .locator("option")
    .filter({ hasText: "Alex" })
    .getAttribute("value");
  await page.getByLabel("Choose a participant").selectOption(alexId!);
  expect(
    await page
      .getByRole("link", { name: "WhatsApp", exact: true })
      .getAttribute("href"),
  ).toContain("https://wa.me/27821234567?");
  expect(await page.getByLabel("Invite link").inputValue()).not.toContain(
    "0821234567",
  );
  expect(
    await page.evaluate(async () => (await import("/src/lib/privateStorage.ts")).privateLocal.getItem("splitease-draft-v2")),
  ).not.toContain("0821234567");
});
test("scanner decodes real QR image and lets recipient review the request", async ({
  page,
}) => {
  await startSplit(page);
  await page.getByRole("button", { name: "Create payment invites" }).click();
  const url = await page.getByLabel("Invite link").inputValue();
  const image = await QRCode.toBuffer(url, { width: 700, margin: 4 });
  await page.getByRole("link", { name: "Scan to pay", exact: true }).click();
  await page.getByLabel("Upload QR image", { exact: true }).setInputFiles({
    name: "invite.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(
    page.getByText("SplitEase request detected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review request" }).click();
  await expect(
    page.getByRole("heading", { name: "Hi You, here is your share." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Test R.*with Stripe/ }),
  ).toBeEnabled();
});
test("scanner does not follow external or executable QR content and handles camera denial", async ({
  page,
}) => {
  await page.goto("/#scan");
  await page
    .getByLabel("Or paste a payment link or QR content")
    .fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Read payment request" }).click();
  await expect(
    page.getByRole("button", { name: "Review request" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/not a supported SplitEase request/),
  ).toBeVisible();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Camera permission denied", "NotAllowedError");
    };
  });
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Camera permission denied",
  );
});
test("invalid invites, sign-in setup and mobile layout work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/#join=broken");
  await expect(
    page.getByRole("heading", { name: "This invite is unavailable." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  if (await page.getByLabel("Email", { exact: true }).count()) {
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  } else {
    await expect(
      page.getByText(/Account registration needs a Supabase connection/),
    ).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Your split" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

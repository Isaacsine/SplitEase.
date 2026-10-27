import { test, expect } from "@playwright/test";
test("public QR destination supports HTTPS domains and deployment paths", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { publicAppUrl } = await import("/src/lib/publicLinks.ts");
    return [
      publicAppUrl("https://payments.example.test/splitease/"),
      publicAppUrl(""),
    ];
  });
  expect(result[0]).toBe("https://payments.example.test/splitease/");
  expect(result[1]).toBe(new URL(page.url()).origin + "/");
});
test("public QR configuration rejects unsafe or ambiguous destinations", async ({
  page,
}) => {
  await page.goto("/");
  const rejected = await page.evaluate(async () => {
    const { publicAppUrl } = await import("/src/lib/publicLinks.ts");
    return [
      "javascript:alert(1)",
      "http://example.test/",
      "https://user:password@example.test/",
      "https://example.test/#account",
      "https://example.test/?redirect=other",
    ].map((value) => {
      try {
        publicAppUrl(value);
        return false;
      } catch {
        return true;
      }
    });
  });
  expect(rejected).toEqual([true, true, true, true, true]);
});

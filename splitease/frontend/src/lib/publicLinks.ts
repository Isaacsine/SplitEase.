// Shareable links can point at the deployed app even when created locally.
export function publicAppUrl(
  configured = import.meta.env.VITE_PUBLIC_APP_URL || "",
) {
  const url = new URL(configured.trim() || location.origin + location.pathname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new Error(
      "Set VITE_PUBLIC_APP_URL to your app's HTTPS address without a query or fragment.",
    );
  }
  return url.origin + url.pathname;
}

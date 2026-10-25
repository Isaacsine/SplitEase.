import type { CreatePaymentInput } from "./providers/PaymentProvider.js";
export function parseCreatePayment(body: unknown): CreatePaymentInput {
  if (!body || typeof body !== "object") throw new Error("Request body must be an object.");
  const value = body as Record<string, unknown>, amountCents = value.amountCents, currency = value.currency ?? "ZAR", description = value.description;
  if (!Number.isSafeInteger(amountCents) || (amountCents as number) < 1 || (amountCents as number) > 100_000_000) throw new Error("amountCents must be an integer between 1 and 100000000.");
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a 3-letter code.");
  if (typeof description !== "string" || description.trim().length < 1 || description.length > 120) throw new Error("description must be between 1 and 120 characters.");
  if (value.customerEmail !== undefined && (typeof value.customerEmail !== "string" || value.customerEmail.length > 254)) throw new Error("customerEmail is invalid.");
  const metadata = value.metadata && typeof value.metadata === "object" ? value.metadata as Record<string, string> : {};
  return { amountCents: amountCents as number, currency, description: description.trim(), customerEmail: value.customerEmail as string | undefined, metadata, simulate: value.simulate === "failure" ? "failure" : "success" };
}

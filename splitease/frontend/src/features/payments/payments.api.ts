import { api } from "../../lib/api";

export const paymentUnavailable =
  "Mock payments are enabled for development. No bank connection or real money movement is enabled.";

export type MockPayment = {
  id: string;
  amountCents: number;
  currency: string;
  description: string;
  status: "succeeded" | "failed" | "refunded";
  provider: "mock";
};

export async function createMockPayment(input: {
  amountCents: number;
  description: string;
  idempotencyKey?: string;
  simulate?: "success" | "failure";
}) {
  return api<{ payment: MockPayment; simulated: true }>("/api/payments", {
    method: "POST",
    headers: input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : undefined,
    body: JSON.stringify({ amountCents: input.amountCents, description: input.description, currency: "ZAR", simulate: input.simulate }),
  });
}

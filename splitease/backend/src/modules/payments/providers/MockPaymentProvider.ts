import { randomUUID } from "node:crypto";
import type { CreatePaymentInput, PaymentProvider, ProviderPayment } from "./PaymentProvider.js";
/** Deterministic local provider. It never contacts a bank or moves money. */
export class MockPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<ProviderPayment> { return { provider: "mock", providerPaymentId: `mock_${randomUUID()}`, status: input.simulate === "failure" ? "failed" : "succeeded" }; }
  async refundPayment(_providerPaymentId: string) { return { status: "refunded" as const }; }
}

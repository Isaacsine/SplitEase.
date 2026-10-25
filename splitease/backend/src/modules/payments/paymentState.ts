export type PaymentStatus = "succeeded" | "failed" | "refunded";
export type PaymentRecord = { id: string; amountCents: number; currency: string; description: string; customerEmail?: string; metadata: Record<string, string>; status: PaymentStatus; provider: "mock"; providerPaymentId: string; createdAt: string; updatedAt: string };

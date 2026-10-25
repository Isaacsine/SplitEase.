export type ProviderPaymentStatus = "succeeded" | "failed";
export type CreatePaymentInput = { amountCents: number; currency: string; description: string; customerEmail?: string; metadata?: Record<string, string>; simulate?: "success" | "failure" };
export type ProviderPayment = { provider: "mock"; providerPaymentId: string; status: ProviderPaymentStatus };
export interface PaymentProvider { createPayment(input: CreatePaymentInput): Promise<ProviderPayment>; refundPayment(providerPaymentId: string): Promise<{ status: "refunded" }>; }

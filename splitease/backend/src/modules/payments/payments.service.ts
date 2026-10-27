import { IdempotencyStore } from "../../lib/idempotency.js";
import { MockPaymentProvider } from "./providers/MockPaymentProvider.js";
import type { CreatePaymentInput } from "./providers/PaymentProvider.js";
import type { PaymentRecord } from "./paymentState.js";
import { newPaymentId, type PaymentRepository } from "./payments.repository.js";
export class PaymentsService {
  private readonly idempotency = new IdempotencyStore<PaymentRecord>(); private readonly provider = new MockPaymentProvider();
  constructor(private readonly repository: PaymentRepository) {}
  async create(input: CreatePaymentInput, key?: string) { const existing = key ? await this.repository.findByIdempotencyKey(key) || this.idempotency.get(key) : undefined; if (existing) return existing; const provider = await this.provider.createPayment(input), now = new Date().toISOString(); const record: PaymentRecord = { id: newPaymentId(), amountCents: input.amountCents, currency: input.currency, description: input.description, customerEmail: input.customerEmail, metadata: input.metadata || {}, status: provider.status, provider: provider.provider, providerPaymentId: provider.providerPaymentId, createdAt: now, updatedAt: now }; await this.repository.insert(record, key); if (key) this.idempotency.set(key, record); return record; }
  get(id: string) { return this.repository.findById(id); }
  async refund(id: string) { const record = await this.repository.findById(id); if (!record) return undefined; if (record.status === "failed") throw new Error("A failed payment cannot be refunded."); if (record.status === "refunded") return record; await this.provider.refundPayment(record.providerPaymentId); return this.repository.updateStatus(id, "refunded", new Date().toISOString()); }
}

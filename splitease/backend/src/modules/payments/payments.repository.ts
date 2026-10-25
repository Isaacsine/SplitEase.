import { randomUUID } from "node:crypto";
import type { AppEnv } from "../../config/env.js";
import type { PaymentRecord, PaymentStatus } from "./paymentState.js";

export type PaymentRepository = {
  findById(id: string): Promise<PaymentRecord | undefined>;
  findByIdempotencyKey(key: string): Promise<PaymentRecord | undefined>;
  insert(record: PaymentRecord, idempotencyKey?: string): Promise<void>;
  updateStatus(id: string, status: PaymentStatus, updatedAt: string): Promise<PaymentRecord | undefined>;
};

export class MemoryPaymentRepository implements PaymentRepository {
  private readonly records = new Map<string, PaymentRecord>();
  private readonly keys = new Map<string, string>();
  async findById(id: string) { return this.records.get(id); }
  async findByIdempotencyKey(key: string) { const id = this.keys.get(key); return id ? this.records.get(id) : undefined; }
  async insert(record: PaymentRecord, idempotencyKey?: string) { this.records.set(record.id, record); if (idempotencyKey) this.keys.set(idempotencyKey, record.id); }
  async updateStatus(id: string, status: PaymentStatus, updatedAt: string) { const record = this.records.get(id); if (!record) return undefined; const updated = { ...record, status, updatedAt }; this.records.set(id, updated); return updated; }
}

type SupabasePaymentRow = { id: string; amount_cents: number; currency: string; description: string; customer_email?: string | null; metadata: Record<string, string>; status: PaymentStatus; provider: "mock"; provider_payment_id: string; created_at: string; updated_at: string };
function fromRow(row: SupabasePaymentRow): PaymentRecord { return { id: row.id, amountCents: row.amount_cents, currency: row.currency, description: row.description, customerEmail: row.customer_email || undefined, metadata: row.metadata || {}, status: row.status, provider: row.provider, providerPaymentId: row.provider_payment_id, createdAt: row.created_at, updatedAt: row.updated_at }; }

export class SupabasePaymentRepository implements PaymentRepository {
  private readonly baseUrl: string;
  constructor(private readonly env: AppEnv) { this.baseUrl = `${env.supabaseUrl!.replace(/\/$/, "")}/rest/v1`; }
  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}/${path}`, { ...init, headers: { apikey: this.env.supabaseServiceRoleKey!, Authorization: `Bearer ${this.env.supabaseServiceRoleKey!}`, "Content-Type": "application/json", ...(init.headers || {}) } });
    if (!response.ok) throw new Error(`Supabase persistence request failed (${response.status}).`);
    return response;
  }
  private async one(path: string) { const response = await this.request(path, { headers: { Accept: "application/vnd.pgrst.object+json" } }); if (response.status === 204) return undefined; const text = await response.text(); return text ? fromRow(JSON.parse(text) as SupabasePaymentRow) : undefined; }
  async findById(id: string) { try { return await this.one(`backend_payments?id=eq.${encodeURIComponent(id)}`); } catch (error) { if (error instanceof Error && error.message.includes("(406)")) return undefined; throw error; } }
  async findByIdempotencyKey(key: string) { try { return await this.one(`backend_payments?idempotency_key=eq.${encodeURIComponent(key)}`); } catch (error) { if (error instanceof Error && error.message.includes("(406)")) return undefined; throw error; } }
  async insert(record: PaymentRecord, idempotencyKey?: string) { await this.request("backend_payments", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: record.id, idempotency_key: idempotencyKey || null, amount_cents: record.amountCents, currency: record.currency, description: record.description, customer_email: record.customerEmail || null, metadata: record.metadata, status: record.status, provider: record.provider, provider_payment_id: record.providerPaymentId, created_at: record.createdAt, updated_at: record.updatedAt }) }); await this.request("backend_audit_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ entity_type: "payment", entity_id: record.id, action: "created", payload: { status: record.status, amount_cents: record.amountCents } }) }); }
  async updateStatus(id: string, status: PaymentStatus, updatedAt: string) { const response = await this.request(`backend_payments?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status, updated_at: updatedAt }) }); const rows = (await response.json()) as SupabasePaymentRow[]; if (!rows[0]) return undefined; await this.request("backend_audit_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ entity_type: "payment", entity_id: id, action: status, payload: { status } }) }); return fromRow(rows[0]); }
}

export function createPaymentRepository(env: AppEnv): PaymentRepository { return env.persistence === "supabase" ? new SupabasePaymentRepository(env) : new MemoryPaymentRepository(); }
export function newPaymentId() { return randomUUID(); }

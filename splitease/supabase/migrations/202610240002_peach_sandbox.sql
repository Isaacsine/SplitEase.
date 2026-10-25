-- Historical migration: gateway integration has been removed from the prototype.
-- Do not run this for the prototype. Existing database tables are left untouched.
-- Run once after 202610240001_payment_requests.sql.
-- Sandbox-only attempts. Client users have no direct read/write access.
create table public.sandbox_payment_attempts (
 request_id uuid primary key references public.payment_requests(id) on delete restrict,
 provider_payment_id text not null unique default ('pay_' || replace(gen_random_uuid()::text, '-', '')),
 amount_cents bigint not null check (amount_cents between 1 and 100000000),
 currency text not null default 'ZAR' check (currency = 'ZAR'),
 state text not null default 'created' check (state in ('created','requires_payment_method','requires_confirmation','requires_action','requires_capture','processing','succeeded','failed','cancelled','partially_captured')),
 checkout_url text,
 created_at timestamptz not null default now(),
 checked_at timestamptz
);
alter table public.sandbox_payment_attempts enable row level security;
revoke all on public.sandbox_payment_attempts from anon, authenticated;
grant select, insert, update on public.sandbox_payment_attempts to service_role;
-- Row-per-request reservation and deterministic provider ID prevent creating a second checkout
-- for a repeated click/retry. Production multi-attempt payment logic is intentionally not enabled.

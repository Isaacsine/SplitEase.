-- Backend persistence for the mock payment layer.
-- Existing migrations already provide auth.users, group_rooms, members and invitations.
create table if not exists public.backend_payments (
  id uuid primary key,
  idempotency_key text unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  description text not null,
  customer_email text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null check (status in ('succeeded', 'failed', 'refunded')),
  provider text not null default 'mock',
  provider_payment_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backend_audit_events (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.backend_payments enable row level security;
alter table public.backend_audit_events enable row level security;
revoke all on public.backend_payments from anon, authenticated;
revoke all on public.backend_audit_events from anon, authenticated;
grant all on public.backend_payments to service_role;
grant all on public.backend_audit_events to service_role;
create index if not exists backend_payments_created_at_idx on public.backend_payments (created_at desc);
create index if not exists backend_audit_entity_idx on public.backend_audit_events (entity_type, entity_id, created_at desc);

create or replace function public.prevent_backend_audit_update()
returns trigger language plpgsql as $$
begin
  raise exception 'backend audit events are immutable';
end;
$$;
drop trigger if exists backend_audit_immutable on public.backend_audit_events;
create trigger backend_audit_immutable before update or delete on public.backend_audit_events
for each row execute function public.prevent_backend_audit_update();

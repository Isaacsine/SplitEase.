-- Apply in your Supabase SQL editor before enabling tracked invitations.
create table public.payment_requests (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 split_id uuid not null,
 participant_id uuid not null,
 token uuid not null unique default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 100),
 recipient_name text not null check (char_length(recipient_name) between 1 and 60),
 amount_cents bigint not null check (amount_cents between 1 and 100000000),
 total_cents bigint not null check (total_cents between 1 and 100000000 and total_cents >= amount_cents),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.payment_requests enable row level security;
revoke all on public.payment_requests from anon, authenticated;
grant select, insert, delete on public.payment_requests to authenticated;
create policy owner_read on public.payment_requests for select to authenticated using ((select auth.uid()) = owner_id);
create policy owner_insert on public.payment_requests for insert to authenticated with check ((select auth.uid()) = owner_id and expires_at > now() and expires_at <= now() + interval '7 days');
create policy owner_delete on public.payment_requests for delete to authenticated using ((select auth.uid()) = owner_id);
create index payment_requests_owner on public.payment_requests(owner_id);
-- Possession of an unguessable invitation token grants access only to the request summary.
-- No bank account, phone, email, owner identifier, payment status, or authorisation is exposed.
create function public.read_payment_request(request_token uuid)
returns table(id uuid,title text,recipient_name text,amount_cents bigint,total_cents bigint,expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select r.id,r.title,r.recipient_name,r.amount_cents,r.total_cents,r.expires_at
 from public.payment_requests r where r.token=request_token and r.expires_at > now();
$$;
revoke all on function public.read_payment_request(uuid) from public;
grant execute on function public.read_payment_request(uuid) to anon, authenticated;
-- Real payment state must be server-owned and updated only from verified provider callbacks.

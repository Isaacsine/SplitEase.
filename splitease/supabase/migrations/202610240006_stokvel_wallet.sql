-- Prototype only: no money is held, debited or transferred.
begin;
alter table public.monthly_plans drop constraint monthly_plans_kind_check;
alter table public.monthly_plans add constraint monthly_plans_kind_check check(kind in ('expense','savings','stokvel'));
alter table public.monthly_plans add column order_revision integer not null default 1;
alter table public.plan_members add column accepted_order integer not null default 0;
create table public.stokvel_order(plan_id uuid not null references public.monthly_plans(id) on delete cascade,position integer not null,member_id uuid not null references public.plan_members(id) on delete cascade,primary key(plan_id,position),unique(plan_id,member_id));
create table public.stokvel_payouts(plan_id uuid not null references public.monthly_plans(id) on delete cascade,month date not null,member_id uuid not null references public.plan_members(id) on delete cascade,cents bigint not null check(cents>0),received boolean not null default false,primary key(plan_id,month));
alter table public.stokvel_order enable row level security;
alter table public.stokvel_payouts enable row level security;
revoke all on public.stokvel_order,public.stokvel_payouts from anon,authenticated;
create or replace function public.plan_sync(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.monthly_plans;cur date:=date_trunc('month',now() at time zone 'Africa/Johannesburg')::date;
begin
 select * into p from public.monthly_plans where id=p_id;
 if not found or not p.active then return;end if;
 insert into public.plan_periods(member_id,month,due_date,cents,revision)
 select m.id,s.month::date,(s.month+ (least(p.due_day,extract(day from s.month+interval '1 month - 1 day')::integer)-1)*interval '1 day')::date,a.cents,a.revision
 from public.plan_members m cross join generate_series(p.start_month,least(cur+interval '1 month',case when p.kind='stokvel' then p.start_month+((select count(*) from public.plan_members where plan_id=p.id)-1)*interval '1 month' else cur+interval '1 month' end),interval '1 month') s(month)
 cross join lateral(select cents,revision from public.plan_proposals where member_id=m.id and accepted and effective_month<=s.month order by effective_month desc,revision desc limit 1) a
 where m.plan_id=p.id on conflict(member_id,month) do update set cents=excluded.cents,revision=excluded.revision where plan_periods.month>cur and plan_periods.status='due';
end $$;
revoke all on function public.plan_sync(uuid) from public;

create function public.stokvel_sync(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.stokvel_payouts(plan_id,month,member_id,cents)
 select p.id,(p.start_month+o.position*interval '1 month')::date,o.member_id,sum(x.cents)
 from public.monthly_plans p join public.stokvel_order o on o.plan_id=p.id join public.plan_members m on m.plan_id=p.id
 join public.plan_periods x on x.member_id=m.id and x.month=(p.start_month+o.position*interval '1 month')::date
 where p.id=p_id and p.active and p.kind='stokvel' and (p.start_month+(o.position+1)*interval '1 month'-interval '1 day')::date<=(now() at time zone 'Africa/Johannesburg')::date
 group by p.id,o.position,o.member_id
 having count(*)=(select count(*) from public.plan_members where plan_id=p_id) and bool_and(x.status='confirmed')
 on conflict(plan_id,month) do nothing;
end $$;
revoke all on function public.stokvel_sync(uuid) from public;
alter function public.plan_read(uuid,uuid) rename to plan_read_v5;
revoke all on function public.plan_read_v5(uuid,uuid) from public,anon,authenticated;
create function public.plan_read(p_token uuid,p_seat uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p public.monthly_plans;members jsonb;rotation jsonb;
begin
 result:=public.plan_read_v5(p_token,p_seat);
 select * into p from public.monthly_plans where token=p_token;
 if p.kind<>'stokvel' then return result;end if;
 perform public.stokvel_sync(p.id);
 select jsonb_agg(x.value||jsonb_build_object('orderAccepted',m.accepted_order=p.order_revision) order by m.position) into members from jsonb_array_elements(result->'members') x join public.plan_members m on m.id=(x.value->>'id')::uuid;
 select jsonb_build_object('revision',p.order_revision,'order',coalesce((select jsonb_agg(member_id order by position) from public.stokvel_order where plan_id=p.id),'[]'::jsonb),'payouts',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(month,'YYYY-MM'),'recipient',member_id,'cents',cents,'received',received) order by month) from public.stokvel_payouts where plan_id=p.id),'[]'::jsonb)) into rotation;
 return result||jsonb_build_object('members',members,'rotation',rotation);
end $$;
alter function public.plan_create(jsonb) rename to plan_create_v5;
revoke all on function public.plan_create_v5(jsonb) from public,anon,authenticated;
create function public.plan_create(p_draft jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p public.monthly_plans;
begin
 if p_draft->>'kind'='stokvel' and (select count(distinct value->>'cents') from jsonb_array_elements(p_draft->'members'))<>1 then raise exception 'Every stokvel member contributes the same amount';end if;
 result:=public.plan_create_v5(p_draft);
 select * into p from public.monthly_plans where token=(result->>'key')::uuid;
 if p.kind='stokvel' then insert into public.stokvel_order(plan_id,position,member_id) select p.id,position,id from public.plan_members where plan_id=p.id;end if;
 return public.plan_read(p.token,null);
end $$;
alter function public.plan_action(uuid,uuid,text,uuid,uuid,jsonb) rename to plan_action_v5;
revoke all on function public.plan_action_v5(uuid,uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
create function public.plan_action(p_token uuid,p_seat uuid default null,p_action text default '',p_member uuid default null,p_period uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.monthly_plans;me public.plan_members;result jsonb;
begin
 select * into p from public.monthly_plans where token=p_token for update;
 if not found then raise exception 'Plan not found';end if;
 if p.kind<>'stokvel' then return public.plan_action_v5(p_token,p_seat,p_action,p_member,p_period,p_data);end if;
 perform public.plan_read(p_token,p_seat);
 select * into me from public.plan_members where plan_id=p.id and user_id=(select auth.uid()) and ((p_seat is not null and token=p_seat) or (p_seat is null and position=0 and p.owner_id=(select auth.uid())));
 if p_action='order' then
  if p.active or me.id is null then raise exception 'Only signed-in members can propose an order before the round starts';end if;
  if (p_data->>'revision')::integer is distinct from p.order_revision or jsonb_typeof(p_data->'order') is distinct from 'array' then raise exception 'Review the latest order';end if;
  if jsonb_array_length(p_data->'order')<>(select count(*) from public.plan_members where plan_id=p.id) or (select count(distinct value) from jsonb_array_elements_text(p_data->'order'))<>(select count(*) from public.plan_members where plan_id=p.id) or exists(select 1 from jsonb_array_elements_text(p_data->'order') x where not exists(select 1 from public.plan_members where plan_id=p.id and id::text=x.value)) then raise exception 'Choose every member exactly once';end if;
  delete from public.stokvel_order where plan_id=p.id;
  insert into public.stokvel_order(plan_id,position,member_id) select p.id,(ordinality-1)::integer,value::uuid from jsonb_array_elements_text(p_data->'order') with ordinality;
  update public.monthly_plans set order_revision=order_revision+1 where id=p.id;
  update public.plan_members set accepted_order=0 where plan_id=p.id;
 elsif p_action='receive' then
  if me.id is null or not exists(select 1 from public.stokvel_payouts where plan_id=p.id and to_char(month,'YYYY-MM')=p_data->>'month' and member_id=me.id) then raise exception 'Only the scheduled recipient can acknowledge this simulated payout';end if;
  update public.stokvel_payouts set received=true where plan_id=p.id and to_char(month,'YYYY-MM')=p_data->>'month' and member_id=me.id;
 else
  if p_action='propose' and p.active then raise exception 'Stokvel contributions are fixed for this round';end if;
  if p_action='accept' and (p_data->>'orderRevision')::integer is distinct from p.order_revision then raise exception 'The payout order changed. Review it again';end if;
  if p_action='start' then
   if exists(select 1 from public.plan_members where plan_id=p.id and accepted_order<>p.order_revision) then raise exception 'Everyone must accept the payout order';end if;
   if (select count(distinct a.cents) from public.plan_members m cross join lateral(select cents from public.plan_proposals where member_id=m.id order by revision desc limit 1) a where m.plan_id=p.id)<>1 then raise exception 'Stokvel contributions must be equal';end if;
  end if;
  result:=public.plan_action_v5(p_token,p_seat,p_action,p_member,p_period,p_data);
  if p_action='accept' then update public.plan_members set accepted_order=p.order_revision where plan_id=p.id and id=p_member;end if;
 end if;
 return public.plan_read(p_token,p_seat);
end $$;
revoke all on function public.plan_read(uuid,uuid),public.plan_create(jsonb),public.plan_action(uuid,uuid,text,uuid,uuid,jsonb) from public;
grant execute on function public.plan_read(uuid,uuid),public.plan_action(uuid,uuid,text,uuid,uuid,jsonb) to anon,authenticated;
grant execute on function public.plan_create(jsonb) to authenticated;
-- Personal simulated wallet. No provider, bank account, interest or automatic spending.
create table public.prototype_wallets(user_id uuid primary key references auth.users(id) on delete cascade,balance bigint not null default 0 check(balance between 0 and 100000000));
create table public.prototype_wallet_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,kind text not null check(kind in ('add','move','use')),cents bigint not null check(cents between 1 and 100000000),label text not null check(char_length(label)<=80),created_at timestamptz not null default clock_timestamp(),unique(user_id,request_id));
alter table public.prototype_wallets enable row level security;
alter table public.prototype_wallet_entries enable row level security;
revoke all on public.prototype_wallets,public.prototype_wallet_entries from anon,authenticated;
create function public.wallet_read() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid());result jsonb;
begin
 if uid is null then raise exception 'Sign in to open your account wallet';end if;
 return jsonb_build_object('balance',coalesce((select balance from public.prototype_wallets where user_id=uid),0),'entries',coalesce((select jsonb_agg(x.item order by x.created_at desc) from (select created_at,jsonb_build_object('id',id,'kind',kind,'cents',cents,'label',label,'createdAt',created_at) item from public.prototype_wallet_entries where user_id=uid order by created_at desc limit 100) x),'[]'::jsonb));
end $$;
create function public.wallet_action(p_kind text,p_cents bigint,p_label text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid());balance_now bigint;existing public.prototype_wallet_entries;
begin
 if uid is null then raise exception 'Sign in to use your account wallet';end if;
 if p_kind not in ('add','move','use') or p_cents is null or p_cents not between 1 and 100000000 or p_label is null or char_length(p_label)>80 or p_request is null then raise exception 'Invalid wallet entry';end if;
 insert into public.prototype_wallets(user_id) values(uid) on conflict do nothing;
 select balance into balance_now from public.prototype_wallets where user_id=uid for update;
 select * into existing from public.prototype_wallet_entries where user_id=uid and request_id=p_request;
 if found then
  if existing.kind<>p_kind or existing.cents<>p_cents or existing.label<>p_label then raise exception 'This request was already used for another entry';end if;
  return public.wallet_read();
 end if;
 if p_kind<>'add' and p_cents>balance_now then raise exception 'Not enough available balance';end if;
 if p_kind='add' and balance_now+p_cents>100000000 then raise exception 'Prototype wallet limit is R1,000,000';end if;
 update public.prototype_wallets set balance=balance_now+case when p_kind='add' then p_cents else -p_cents end where user_id=uid;
 insert into public.prototype_wallet_entries(user_id,request_id,kind,cents,label) values(uid,p_request,p_kind,p_cents,p_label);
 return public.wallet_read();
end $$;
revoke all on function public.wallet_read(),public.wallet_action(text,bigint,text,uuid) from public;
grant execute on function public.wallet_read(),public.wallet_action(text,bigint,text,uuid) to authenticated;
commit;

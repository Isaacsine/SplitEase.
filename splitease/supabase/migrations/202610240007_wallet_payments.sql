-- Simulated wallet spending only. No banking gateway or actual funds.
begin;
create table public.wallet_payment_receipts(user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,target text not null check(target in ('plan','room','payment')),target_key text not null,cents bigint not null check(cents>0),created_at timestamptz not null default clock_timestamp(),primary key(user_id,request_id),unique(target,target_key));
alter table public.wallet_payment_receipts enable row level security;
revoke all on public.wallet_payment_receipts from anon,authenticated;
create function public.wallet_pay(p_target text,p_token uuid default null,p_seat uuid default null,p_item uuid default null,p_cents bigint default null,p_request uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid());p public.monthly_plans;pm public.plan_members;period public.plan_periods;r public.group_rooms;rm public.group_room_members;v_key text;label text;receipt public.wallet_payment_receipts;amount bigint;
begin
 if uid is null then raise exception 'Sign in to spend from your account wallet';end if;
 if p_request is null or p_cents is null or p_cents not between 1 and 100000000 then raise exception 'Invalid payment';end if;
 if p_target='plan' then
  select * into p from public.monthly_plans where token=p_token for update;
  if not found or not p.active then raise exception 'This plan is not active';end if;
  perform public.plan_sync(p.id);
  select * into pm from public.plan_members where plan_id=p.id and user_id=uid and ((p_seat is not null and token=p_seat) or (p_seat is null and position=0 and p.owner_id=uid));
  if not found then raise exception 'You can only fund your own contribution';end if;
  select * into period from public.plan_periods where id=p_item and member_id=pm.id for update;
  if not found then raise exception 'Contribution not found';end if;
  v_key:=period.id::text;amount:=period.cents;label:=left(p.title||' - '||to_char(period.month,'YYYY-MM'),80);
 elsif p_target='room' then
  select * into r from public.group_rooms where access_token=p_token for update;
  if not found then raise exception 'Group not found';end if;
  select * into rm from public.group_room_members where room_id=r.id and id=p_item and ((p_seat is not null and seat_token=p_seat) or (p_seat is null and position=0 and r.owner_id=uid));
  if not found then raise exception 'Open your own participant link';end if;
  v_key:=rm.id::text;amount:=rm.share_cents;label:=left(r.title,80);
 elsif p_target='payment' then
  if p_item is null then raise exception 'Payment reference required';end if;
  v_key:=p_item::text;amount:=p_cents;label:='Bill payment';
 else raise exception 'Unknown payment destination';end if;
 if p_cents<>amount then raise exception 'This amount changed. Review the payment again';end if;
 -- Serialise all wallet changes for this user before checking receipts or balances.
 insert into public.prototype_wallets(user_id) values(uid) on conflict do nothing;
 perform 1 from public.prototype_wallets where user_id=uid for update;
 select * into receipt from public.wallet_payment_receipts where user_id=uid and request_id=p_request;
 if found then
  if receipt.target<>p_target or receipt.target_key<>v_key or receipt.cents<>amount then raise exception 'This request was already used';end if;
  return public.wallet_read();
 end if;
 if exists(select 1 from public.wallet_payment_receipts x where x.target=p_target and x.target_key=v_key) then raise exception 'This contribution has already been paid from a wallet';end if;
 if p_target='plan' and period.status<>'due' then raise exception 'This contribution is already recorded';end if;
 if p_target='room' and (r.completed or rm.choice<>'now' or rm.preview_state in ('covered','credit_funded')) then raise exception 'This share is already covered or uses a different payment method';end if;
 perform public.wallet_action('use',amount,label,p_request);
 insert into public.wallet_payment_receipts(user_id,request_id,target,target_key,cents) values(uid,p_request,p_target,v_key,amount);
 if p_target='plan' then update public.plan_periods set status='confirmed',confirmed_at=now() where id=period.id;
 elsif p_target='room' then update public.group_room_members set preview_state='covered',repaid=0 where id=rm.id;end if;
 return public.wallet_read();
end $$;
revoke all on function public.wallet_pay(text,uuid,uuid,uuid,bigint,uuid) from public;
grant execute on function public.wallet_pay(text,uuid,uuid,uuid,bigint,uuid) to authenticated;
commit;

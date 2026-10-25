-- Monthly contributions are tracking records, not payment processing or debit mandates.
begin;
create table public.monthly_plans (
 id uuid primary key default gen_random_uuid(), token uuid unique not null default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 100),kind text not null check(kind in ('expense','savings')),target bigint not null default 0 check(target between 0 and 100000000),
 due_day integer not null check(due_day between 1 and 31),start_month date not null,active boolean not null default false,created_at timestamptz not null default now(),check(kind<>'savings' or target>0)
);
create table public.plan_members (
 id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.monthly_plans(id) on delete cascade,token uuid unique not null default gen_random_uuid(),position integer not null,user_id uuid references auth.users(id) on delete set null,
 name text not null check(char_length(name) between 1 and 60),method text not null default 'manual' check(method in ('manual','debit_preview')),reminders boolean not null default true,reminder_days integer not null default 3 check(reminder_days in (0,1,3,7))
);
create unique index plan_member_account on public.plan_members(plan_id,user_id) where user_id is not null;
create table public.plan_proposals (
 member_id uuid not null references public.plan_members(id) on delete cascade,revision integer not null,cents bigint not null check(cents between 1 and 100000000),effective_month date not null,accepted boolean not null default false,primary key(member_id,revision)
);
create table public.plan_periods (
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.plan_members(id) on delete cascade,month date not null,due_date date not null,cents bigint not null check(cents>0),revision integer not null,
 status text not null default 'due' check(status in ('due','declared','confirmed')),confirmed_at timestamptz,unique(member_id,month)
);
create index plans_owner on public.monthly_plans(owner_id);
create index plan_members_parent on public.plan_members(plan_id);
alter table public.monthly_plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.plan_proposals enable row level security;
alter table public.plan_periods enable row level security;
revoke all on public.monthly_plans,public.plan_members,public.plan_proposals,public.plan_periods from anon,authenticated;
grant select on public.monthly_plans to authenticated;
create policy plans_owner_read on public.monthly_plans for select to authenticated using((select auth.uid())=owner_id);
-- Materialise begun months and the next month so pre-due reminders cross month boundaries.
-- Past/current rows are immutable snapshots. Only unpaid future rows follow newly accepted agreements.
create function public.plan_sync(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.monthly_plans;cur date:=date_trunc('month',now() at time zone 'Africa/Johannesburg')::date;
begin
 select * into p from public.monthly_plans where id=p_id;
 if not found or not p.active then return;end if;
 insert into public.plan_periods(member_id,month,due_date,cents,revision)
 select m.id,s.month::date,(s.month+ (least(p.due_day,extract(day from s.month+interval '1 month - 1 day')::integer)-1)*interval '1 day')::date,a.cents,a.revision
 from public.plan_members m cross join generate_series(p.start_month,cur+interval '1 month',interval '1 month') s(month)
 cross join lateral(select cents,revision from public.plan_proposals where member_id=m.id and accepted and effective_month<=s.month order by effective_month desc,revision desc limit 1) a
 where m.plan_id=p.id on conflict(member_id,month) do update set cents=excluded.cents,revision=excluded.revision where plan_periods.month>cur and plan_periods.status='due';
end $$;
revoke all on function public.plan_sync(uuid) from public;
create function public.plan_read(p_token uuid,p_seat uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.monthly_plans; own boolean; members jsonb; periods jsonb;
begin
 select * into p from public.monthly_plans where token=p_token for update;
 if not found then raise exception 'Plan not found';end if;
 if p_seat is not null and not exists(select 1 from public.plan_members where plan_id=p.id and token=p_seat) then raise exception 'Invalid participant link';end if;
 own:=coalesce((select auth.uid())=p.owner_id,false);
 perform public.plan_sync(p.id);
 select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'isMe',case when p_seat is not null then m.token=p_seat and (m.user_id is null or m.user_id=(select auth.uid())) and not (own and m.position<>0) else own and m.position=0 end,
 'token',case when own or m.token=p_seat then m.token else null end,
 'proposal',jsonb_build_object('revision',a.revision,'cents',a.cents,'effective',to_char(a.effective_month,'YYYY-MM'),'accepted',a.accepted),
 'method',case when m.user_id=(select auth.uid()) then m.method else null end,
 'reminders',case when m.token=p_seat or (p_seat is null and own and m.position=0) then m.reminders else null end,
 'days',case when m.token=p_seat or (p_seat is null and own and m.position=0) then m.reminder_days else null end) order by m.position)
 into members from public.plan_members m cross join lateral(select * from public.plan_proposals where member_id=m.id order by revision desc limit 1) a where m.plan_id=p.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'memberId',x.member_id,'month',to_char(x.month,'YYYY-MM'),'due',x.due_date,'cents',x.cents,'status',x.status) order by x.month desc,m.position),'[]'::jsonb)
 into periods from public.plan_periods x join public.plan_members m on m.id=x.member_id where m.plan_id=p.id;
 return jsonb_build_object('key',p.token,'title',p.title,'kind',p.kind,'target',p.target,'day',p.due_day,'start',to_char(p.start_month,'YYYY-MM'),'active',p.active,'owner',own,'mode','cloud','members',members,'periods',periods);
end $$;
create function public.plan_create(p_draft jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.monthly_plans;item jsonb;m uuid;i integer:=0;start_date date;cur date:=date_trunc('month',now() at time zone 'Africa/Johannesburg')::date;
begin
 if (select auth.uid()) is null then raise exception 'Sign in to create a shared plan';end if;
 if jsonb_typeof(p_draft->'members') is distinct from 'array' then raise exception 'Invalid members';end if;
 if jsonb_array_length(p_draft->'members') not between 2 and 20 then raise exception 'Plans need 2 to 20 people';end if;
 if (p_draft->>'start') !~ '^\d{4}-\d{2}$' then raise exception 'Invalid start month';end if;
 start_date:=((p_draft->>'start')||'-01')::date;
 if start_date<cur or start_date>(cur+interval '12 months')::date then raise exception 'Invalid start month';end if;
 insert into public.monthly_plans(owner_id,title,kind,target,due_day,start_month) values((select auth.uid()),trim(p_draft->>'title'),p_draft->>'kind',coalesce((p_draft->>'target')::bigint,0),(p_draft->>'day')::integer,start_date) returning * into p;
 for item in select value from jsonb_array_elements(p_draft->'members') loop
  insert into public.plan_members(plan_id,position,name,user_id) values(p.id,i,trim(item->>'name'),case when i=0 then (select auth.uid()) else null end) returning id into m;
  insert into public.plan_proposals(member_id,revision,cents,effective_month) values(m,1,(item->>'cents')::bigint,start_date);i:=i+1;
 end loop;
 return public.plan_read(p.token,null);
end $$;
create function public.plan_action(p_token uuid,p_seat uuid default null,p_action text default '',p_member uuid default null,p_period uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.monthly_plans;m public.plan_members;me public.plan_members;own boolean;a public.plan_proposals;cur date:=date_trunc('month',now() at time zone 'Africa/Johannesburg')::date;effective date;
begin
 select * into p from public.monthly_plans where token=p_token for update;
 if not found then raise exception 'Plan not found';end if;
 own:=coalesce((select auth.uid())=p.owner_id,false);
 if p_seat is not null then
  select * into me from public.plan_members where plan_id=p.id and token=p_seat;
  if not found then raise exception 'Invalid participant link';end if;
 elsif own then select * into me from public.plan_members where plan_id=p.id and position=0;
 end if;
 perform public.plan_sync(p.id);
 if p_action='start' then
  if not own then raise exception 'Only the organiser starts the plan';end if;
  if p.active then return public.plan_read(p_token,p_seat);end if;
  if exists(select 1 from public.plan_members x where plan_id=p.id and not (select accepted from public.plan_proposals where member_id=x.id order by revision desc limit 1)) then raise exception 'Every person must accept their contribution first';end if;
  -- Delayed activation starts this month: no surprise backdated debt before the plan existed.
  update public.monthly_plans set active=true,start_month=greatest(start_month,cur) where id=p.id;
 elsif p_action='accept' then
  if (select auth.uid()) is null then raise exception 'Sign in to accept your contribution';end if;
  if me.id is null or me.id is distinct from p_member or (own and me.position<>0) or (me.user_id is not null and me.user_id is distinct from (select auth.uid())) then raise exception 'You can only accept your own amount';end if;
  select * into a from public.plan_proposals where member_id=me.id order by revision desc limit 1;
  if (p_data->>'revision')::integer is distinct from a.revision then raise exception 'The proposed amount changed. Review it again';end if;
  update public.plan_members set user_id=(select auth.uid()) where id=me.id;
  update public.plan_proposals set accepted=true where member_id=me.id and revision=a.revision;
 elsif p_action='propose' then
  if not own then raise exception 'Only the organiser proposes changes';end if;
  select * into m from public.plan_members where plan_id=p.id and id=p_member;
  if not found then raise exception 'Participant not found';end if;
  select * into a from public.plan_proposals where member_id=m.id order by revision desc limit 1;
  if (p_data->>'revision')::integer is distinct from a.revision then raise exception 'The amount changed. Refresh the plan';end if;
  if (p_data->>'cents')::bigint=a.cents then raise exception 'Enter a different amount';end if;
  effective:=case when p.active then greatest(p.start_month,(cur+interval '1 month')::date) else greatest(p.start_month,cur) end;
  insert into public.plan_proposals(member_id,revision,cents,effective_month) values(m.id,a.revision+1,(p_data->>'cents')::bigint,effective);
 elsif p_action='preferences' then
  if me.id is null or me.id is distinct from p_member or me.user_id is distinct from (select auth.uid()) or (select auth.uid()) is null then raise exception 'Payment preferences are private';end if;
  update public.plan_members set method=p_data->>'method',reminders=(p_data->>'reminders')::boolean,reminder_days=(p_data->>'days')::integer where id=me.id;
 elsif p_action in ('declare','confirm') then
  if not p.active then raise exception 'Start the plan first';end if;
  if p_action='declare' and ((select auth.uid()) is null or me.user_id is distinct from (select auth.uid())) then raise exception 'Sign in to your own account to record a contribution';end if;
  if p_action='confirm' and not own then raise exception 'Only the organiser confirms receipt';end if;
  if not exists(select 1 from public.plan_periods x join public.plan_members z on z.id=x.member_id where x.id=p_period and z.plan_id=p.id and (p_action='confirm' or z.id=me.id)) then raise exception 'You can only declare your own contribution';end if;
  update public.plan_periods set status=case when p_action='confirm' then 'confirmed' else 'declared' end,confirmed_at=case when p_action='confirm' then now() else null end where id=p_period and status<>'confirmed';
 else raise exception 'Unknown plan action';end if;
 return public.plan_read(p_token,p_seat);
end $$;
revoke all on function public.plan_read(uuid,uuid),public.plan_create(jsonb),public.plan_action(uuid,uuid,text,uuid,uuid,jsonb) from public;
grant execute on function public.plan_read(uuid,uuid),public.plan_action(uuid,uuid,text,uuid,uuid,jsonb) to anon,authenticated;
grant execute on function public.plan_create(jsonb) to authenticated;
create function public.plan_list() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('key',p.token,'seat',case when p.owner_id=(select auth.uid()) then null else m.token end,'mode','cloud') order by p.created_at desc),'[]'::jsonb)
 from public.monthly_plans p join public.plan_members m on m.plan_id=p.id and m.user_id=(select auth.uid());
$$;
revoke all on function public.plan_list() from public;
grant execute on function public.plan_list() to authenticated;
commit;

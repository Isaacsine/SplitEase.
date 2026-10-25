-- Chat for monthly plans and stokvel circles.
create table if not exists public.plan_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.monthly_plans(id) on delete cascade,
  member_id uuid references public.plan_members(id) on delete set null,
  sender_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists plan_messages_plan_time on public.plan_messages(plan_id, created_at desc);
alter table public.plan_messages enable row level security;
revoke all on public.plan_messages from anon, authenticated;

create or replace function public.read_plan_messages(p_plan_token uuid, p_seat uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare p public.monthly_plans; m public.plan_members;
begin
  select * into p from public.monthly_plans where token=p_plan_token;
  if not found then raise exception 'Plan not found'; end if;
  if p_seat is not null then
    select * into m from public.plan_members where plan_id=p.id and token=p_seat;
    if not found then raise exception 'Invalid participant link'; end if;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'senderName',x.sender_name,'body',x.body,'createdAt',x.created_at) order by x.created_at asc) from (select * from public.plan_messages where plan_id=p.id order by created_at desc limit 100) x),'[]'::jsonb);
end;
$$;

create or replace function public.add_plan_message(p_plan_token uuid, p_seat uuid, p_body text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare p public.monthly_plans; m public.plan_members; x public.plan_messages;
begin
  select * into p from public.monthly_plans where token=p_plan_token;
  if not found then raise exception 'Plan not found'; end if;
  if p_seat is not null then
    select * into m from public.plan_members where plan_id=p.id and token=p_seat;
    if not found then raise exception 'Invalid participant link'; end if;
  end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 1000 then raise exception 'Message must be between 1 and 1000 characters'; end if;
  insert into public.plan_messages(plan_id,member_id,sender_name,body) values(p.id,m.id,coalesce(m.name,'Organiser'),trim(p_body)) returning * into x;
  return jsonb_build_object('id',x.id,'senderName',x.sender_name,'body',x.body,'createdAt',x.created_at);
end;
$$;

revoke all on function public.read_plan_messages(uuid,uuid), public.add_plan_message(uuid,uuid,text) from public;
grant execute on function public.read_plan_messages(uuid,uuid), public.add_plan_message(uuid,uuid,text) to anon, authenticated;

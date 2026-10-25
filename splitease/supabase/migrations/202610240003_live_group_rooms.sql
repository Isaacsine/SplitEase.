-- Prototype live rooms. Apply once. No real payments, loans or bank approvals are recorded.
begin;
create table public.group_rooms (
 id uuid primary key default gen_random_uuid(), access_token uuid not null unique default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 100), total_cents bigint not null check(total_cents between 1 and 100000000),
 completed boolean not null default false, created_at timestamptz not null default now()
);
create table public.group_room_members (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.group_rooms(id) on delete cascade,
 seat_token uuid not null unique default gen_random_uuid(), position integer not null,
 name text not null check(char_length(name) between 1 and 60), share_cents bigint not null check(share_cents between 1 and 100000000),
 choice text not null default 'now' check(choice in ('now','cash','instalments')), instalment_count integer not null default 3 check(instalment_count in (3,4)),
 preview_state text not null default 'pending' check(preview_state in ('pending','cash_declared','covered','credit_funded','declined')),
 repaid integer not null default 0 check(repaid between 0 and 4)
);
create index group_rooms_owner on public.group_rooms(owner_id);
create index group_members_room on public.group_room_members(room_id);
alter table public.group_rooms enable row level security;
alter table public.group_room_members enable row level security;
revoke all on public.group_rooms, public.group_room_members from anon, authenticated;
grant select on public.group_rooms to authenticated;
create policy rooms_owner_read on public.group_rooms for select to authenticated using((select auth.uid())=owner_id);
-- Capability read: holders of the room token see names, amounts and simulated choices, not contact data.
-- Member edit tokens are returned only to the organiser or to that member's own token holder.
create function public.read_group_room(p_room_token uuid,p_member_token uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.group_rooms; own boolean; members jsonb;
begin
 select * into r from public.group_rooms where access_token=p_room_token;
 if not found then raise exception 'Room not found'; end if;
 if p_member_token is not null and not exists(select 1 from public.group_room_members where room_id=r.id and seat_token=p_member_token) then raise exception 'Invalid participant link'; end if;
 own := coalesce((select auth.uid())=r.owner_id,false);
 select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'shareCents',m.share_cents,'choice',m.choice,'count',m.instalment_count,'state',m.preview_state,'repaid',m.repaid,
 'isMe',case when p_member_token is not null then m.seat_token=p_member_token else own and m.position=0 end,
 'seatToken',case when own or m.seat_token=p_member_token then m.seat_token else null end) order by m.position)
 into members from public.group_room_members m where m.room_id=r.id;
 return jsonb_build_object('id',r.id,'key',r.access_token,'title',r.title,'totalCents',r.total_cents,'completed',r.completed,'createdAt',r.created_at,'owner',own,'mode','cloud','members',members);
end $$;
create function public.create_group_room(p_title text,p_members jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; total bigint:=0; i integer:=0; r public.group_rooms; choice text; cnt integer; amount bigint;
begin
 if (select auth.uid()) is null then raise exception 'Sign in to create a room'; end if;
 if char_length(trim(p_title)) not between 1 and 100 or jsonb_typeof(p_members) is distinct from 'array' then raise exception 'Invalid room details'; end if;
 if jsonb_array_length(p_members) not between 2 and 20 then raise exception 'Rooms need 2 to 20 participants'; end if;
 for item in select value from jsonb_array_elements(p_members) loop
  if char_length(trim(item->>'name')) not between 1 and 60 or (item->>'share_cents') !~ '^[0-9]+$' then raise exception 'Invalid participant'; end if;
  amount:=(item->>'share_cents')::bigint; if amount not between 1 and 100000000 then raise exception 'Invalid share'; end if;
  total:=total+amount;
 end loop;
 if total not between 1 and 100000000 then raise exception 'Invalid total'; end if;
 insert into public.group_rooms(owner_id,title,total_cents) values((select auth.uid()),trim(p_title),total) returning * into r;
 for item in select value from jsonb_array_elements(p_members) loop
  choice:=coalesce(item->>'choice','now');cnt:=coalesce((item->>'count')::integer,3);
  insert into public.group_room_members(room_id,position,name,share_cents,choice,instalment_count) values(r.id,i,trim(item->>'name'),(item->>'share_cents')::bigint,choice,cnt);i:=i+1;
 end loop;
 return public.read_group_room(r.access_token,null);
end $$;
create function public.update_group_member(p_room_token uuid,p_member_token uuid,p_action text,p_choice text default 'now',p_count integer default 3) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.group_rooms; m public.group_room_members; new_state text; n integer;
begin
 select * into r from public.group_rooms where access_token=p_room_token for update;
 if not found then raise exception 'Room not found'; end if;
 select * into m from public.group_room_members where room_id=r.id and seat_token=p_member_token for update;
 if not found then raise exception 'Invalid participant link'; end if;
 if r.completed and p_action<>'repay' then raise exception 'Split complete: only outstanding repayment previews remain'; end if;
 new_state:=m.preview_state;n:=m.repaid;
 if p_action='method' then
  if p_choice not in ('now','cash','instalments') or p_count not in (3,4) then raise exception 'Invalid payment choice'; end if;
  update public.group_room_members set choice=p_choice,instalment_count=p_count,preview_state='pending',repaid=0 where id=m.id;
 elsif p_action='cash' then
  if (select auth.uid()) is distinct from r.owner_id or m.choice<>'cash' then raise exception 'Only the organiser confirms cash'; end if;new_state:='covered';
 elsif p_action='pay' then
  if m.choice='cash' then new_state:='cash_declared'; elsif m.choice='now' then new_state:='covered'; else raise exception 'Use the credit preview'; end if;
 elsif p_action='credit' then
  if m.choice<>'instalments' or m.share_cents<m.instalment_count then raise exception 'Invalid instalment plan'; end if;new_state:='credit_funded';n:=1;
 elsif p_action='repay' then
  if m.preview_state<>'credit_funded' or m.repaid>=m.instalment_count then raise exception 'No repayment remains'; end if;n:=m.repaid+1;
 elsif p_action='decline' then new_state:='declined';n:=0;
 elsif p_action='reset' then new_state:='pending';n:=0;
 else raise exception 'Unknown action'; end if;
 if p_action<>'method' then update public.group_room_members set preview_state=new_state,repaid=n where id=m.id; end if;
 return public.read_group_room(p_room_token,p_member_token);
end $$;
create function public.complete_group_room(p_room_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.group_rooms;
begin
 select * into r from public.group_rooms where access_token=p_room_token for update;
 if not found or (select auth.uid()) is distinct from r.owner_id then raise exception 'Only the organiser can complete a room'; end if;
 if exists(select 1 from public.group_room_members where room_id=r.id and preview_state not in ('covered','credit_funded')) then raise exception 'Cover every share first'; end if;
 update public.group_rooms set completed=true where id=r.id;
 return public.read_group_room(p_room_token,null);
end $$;
revoke all on function public.read_group_room(uuid,uuid),public.create_group_room(text,jsonb),public.update_group_member(uuid,uuid,text,text,integer),public.complete_group_room(uuid) from public;
grant execute on function public.read_group_room(uuid,uuid),public.update_group_member(uuid,uuid,text,text,integer) to anon, authenticated;
grant execute on function public.create_group_room(text,jsonb),public.complete_group_room(uuid) to authenticated;
commit;
-- Supabase Realtime broadcast carries only a refresh signal on the unguessable room-token channel.
-- Clients re-read the stored room through the capability RPC. No public table SELECT policy or payment gateway is needed.

-- Run after 202610240003_live_group_rooms.sql. All money events describe simulations.
begin;
create table public.group_room_events (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.group_rooms(id) on delete cascade,
 member_id uuid references public.group_room_members(id) on delete cascade,
 actor text not null,
 action text not null check(action in ('created','joined','method','pay','cash','credit','repay','decline','reset','completed')),
 choice text check(choice in ('now','cash','instalments')),
 created_at timestamptz not null default clock_timestamp()
);
create index room_events_time on public.group_room_events(room_id,created_at desc);
create unique index room_member_join_once on public.group_room_events(room_id,member_id) where action='joined';
alter table public.group_room_events enable row level security;
revoke all on public.group_room_events from anon,authenticated;
insert into public.group_room_events(room_id,actor,action,created_at) select id,'Organiser','created',created_at from public.group_rooms;
create function public.record_group_room_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare event_action text; actor_name text;
begin
 if tg_table_name='group_rooms' then
  if tg_op='INSERT' then event_action:='created';
  elsif new.completed and not old.completed then event_action:='completed';
  else return new; end if;
  insert into public.group_room_events(room_id,actor,action) values(new.id,'Organiser',event_action);
 else
  if new.choice is distinct from old.choice or new.instalment_count is distinct from old.instalment_count then event_action:='method';
  elsif new.preview_state is distinct from old.preview_state then
   event_action:=case new.preview_state when 'cash_declared' then 'pay' when 'covered' then case when new.choice='cash' then 'cash' else 'pay' end when 'credit_funded' then 'credit' when 'declined' then 'decline' else 'reset' end;
  elsif new.repaid is distinct from old.repaid then event_action:='repay';
  else return new; end if;
  select case when (select auth.uid())=owner_id then 'Organiser' else new.name end into actor_name from public.group_rooms where id=new.room_id;
  insert into public.group_room_events(room_id,member_id,actor,action,choice) values(new.room_id,new.id,actor_name,event_action,new.choice);
 end if;
 return new;
end $$;
revoke all on function public.record_group_room_event() from public;
create trigger room_activity after insert or update on public.group_rooms for each row execute function public.record_group_room_event();
create trigger member_activity after update on public.group_room_members for each row execute function public.record_group_room_event();
create or replace function public.read_group_room(p_room_token uuid,p_member_token uuid default null) returns jsonb
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
 return jsonb_build_object('id',r.id,'key',r.access_token,'title',r.title,'totalCents',r.total_cents,'completed',r.completed,'createdAt',r.created_at,'owner',own,'mode','cloud','members',members,'events',coalesce((select jsonb_agg(e.payload order by e.created_at desc,e.id desc) from (select id,created_at,jsonb_build_object('id',id,'memberId',member_id,'actor',actor,'action',action,'choice',choice,'createdAt',created_at) payload from public.group_room_events where room_id=r.id order by created_at desc,id desc limit 100) e),'[]'::jsonb));
end $$;

create function public.join_group_room(p_room_token uuid,p_member_token uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.group_rooms; m public.group_room_members;
begin
 select * into r from public.group_rooms where access_token=p_room_token;
 if not found then raise exception 'Room not found'; end if;
 select * into m from public.group_room_members where room_id=r.id and seat_token=p_member_token;
 if not found then raise exception 'Invalid participant link'; end if;
 insert into public.group_room_events(room_id,member_id,actor,action) values(r.id,m.id,m.name,'joined') on conflict do nothing;
end $$;
revoke all on function public.join_group_room(uuid,uuid) from public;
grant execute on function public.join_group_room(uuid,uuid) to anon,authenticated;
commit;

-- Lightweight room chat. Messages are capability-protected by the room and seat tokens.
create table if not exists public.group_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.group_rooms(id) on delete cascade,
  member_id uuid references public.group_room_members(id) on delete set null,
  sender_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists group_room_messages_room_time on public.group_room_messages(room_id, created_at desc);
alter table public.group_room_messages enable row level security;
revoke all on public.group_room_messages from anon, authenticated;

create or replace function public.read_group_room_messages(p_room_token uuid, p_member_token uuid default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare r public.group_rooms; m public.group_room_members;
begin
  select * into r from public.group_rooms where access_token=p_room_token;
  if not found then raise exception 'Group not found'; end if;
  if p_member_token is not null then
    select * into m from public.group_room_members where room_id=r.id and seat_token=p_member_token;
    if not found then raise exception 'Invalid participant link'; end if;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',msg.id,'senderName',msg.sender_name,'body',msg.body,'createdAt',msg.created_at
  ) order by msg.created_at asc) from (
    select * from public.group_room_messages where room_id=r.id order by created_at desc limit 100
  ) msg),'[]'::jsonb);
end;
$$;

create or replace function public.add_group_room_message(p_room_token uuid, p_member_token uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare r public.group_rooms; m public.group_room_members; msg public.group_room_messages;
begin
  select * into r from public.group_rooms where access_token=p_room_token;
  if not found then raise exception 'Group not found'; end if;
  if p_member_token is not null then
    select * into m from public.group_room_members where room_id=r.id and seat_token=p_member_token;
    if not found then raise exception 'Invalid participant link'; end if;
  end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 1000 then raise exception 'Message must be between 1 and 1000 characters'; end if;
  insert into public.group_room_messages(room_id,member_id,sender_name,body)
  values(r.id,m.id,coalesce(m.name,'Organiser'),trim(p_body)) returning * into msg;
  return jsonb_build_object('id',msg.id,'senderName',msg.sender_name,'body',msg.body,'createdAt',msg.created_at);
end;
$$;

revoke all on function public.read_group_room_messages(uuid,uuid), public.add_group_room_message(uuid,uuid,text) from public;
grant execute on function public.read_group_room_messages(uuid,uuid), public.add_group_room_message(uuid,uuid,text) to anon, authenticated;

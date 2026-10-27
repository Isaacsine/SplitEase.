-- Private accounts and explicitly shared invitations. Apply after all existing migrations.
-- This migration changes access rules; it does not delete accounts, plans or shared files.
begin;
alter table public.group_room_members add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists group_room_member_account on public.group_room_members(room_id,user_id) where user_id is not null;

create function public.assert_private_room(p_room_token uuid,p_member_token uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid()); r public.group_rooms; m public.group_room_members;
begin
 if uid is null then raise exception 'Sign in to open this shared group' using errcode='42501'; end if;
 select * into r from public.group_rooms where access_token=p_room_token;
 if not found then raise exception 'Group not found' using errcode='42501'; end if;
 if r.owner_id=uid then
  update public.group_room_members set user_id=uid where room_id=r.id and position=0 and user_id is null;
  return;
 end if;
 select * into m from public.group_room_members where room_id=r.id and seat_token=p_member_token for update;
 if not found or m.position=0 or (m.user_id is not null and m.user_id<>uid) then raise exception 'Use your own shared invitation' using errcode='42501'; end if;
 if m.user_id is null then
  if exists(select 1 from public.group_room_members where room_id=r.id and user_id=uid) then raise exception 'This account already joined the group' using errcode='42501'; end if;
  update public.group_room_members set user_id=uid where id=m.id;
 end if;
end $$;
revoke all on function public.assert_private_room(uuid,uuid) from public,anon,authenticated;

create function public.assert_private_plan(p_token uuid,p_seat uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid()); p public.monthly_plans; m public.plan_members;
begin
 if uid is null then raise exception 'Sign in to open this shared plan' using errcode='42501'; end if;
 select * into p from public.monthly_plans where token=p_token;
 if not found then raise exception 'Plan not found' using errcode='42501'; end if;
 if p.owner_id=uid then return; end if;
 select * into m from public.plan_members where plan_id=p.id and token=p_seat for update;
 if not found or m.position=0 or (m.user_id is not null and m.user_id<>uid) then raise exception 'Use your own shared invitation' using errcode='42501'; end if;
 if m.user_id is null then
  if exists(select 1 from public.plan_members where plan_id=p.id and user_id=uid) then raise exception 'This account already joined the plan' using errcode='42501'; end if;
  update public.plan_members set user_id=uid where id=m.id;
 end if;
end $$;
revoke all on function public.assert_private_plan(uuid,uuid) from public,anon,authenticated;

alter function public.read_group_room(uuid,uuid) rename to read_group_room_before_privacy;
revoke all on function public.read_group_room_before_privacy(uuid,uuid) from public,anon,authenticated;
create function public.read_group_room(p_room_token uuid,p_member_token uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; members jsonb;
begin perform public.assert_private_room(p_room_token,p_member_token); result := public.read_group_room_before_privacy(p_room_token,p_member_token);
 select jsonb_agg(x.value||jsonb_build_object('isMe',coalesce(m.user_id=(select auth.uid()),false)) order by m.position) into members
 from jsonb_array_elements(result->'members') x join public.group_room_members m on m.id=(x.value->>'id')::uuid;
 return result||jsonb_build_object('members',coalesce(members,'[]'::jsonb)); end $$;
revoke all on function public.read_group_room(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_group_room(uuid,uuid) to authenticated;

alter function public.join_group_room(uuid,uuid) rename to join_group_room_before_privacy;
revoke all on function public.join_group_room_before_privacy(uuid,uuid) from public,anon,authenticated;
create function public.join_group_room(p_room_token uuid,p_member_token uuid) returns void language plpgsql security definer set search_path='' as $$

begin perform public.assert_private_room(p_room_token,p_member_token); if not exists(select 1 from public.group_room_members m join public.group_rooms r on r.id=m.room_id where r.access_token=p_room_token and m.seat_token=p_member_token and m.user_id=(select auth.uid())) then raise exception 'Use your own invitation' using errcode='42501'; end if; perform public.join_group_room_before_privacy(p_room_token,p_member_token); return; end $$;
revoke all on function public.join_group_room(uuid,uuid) from public,anon,authenticated;
grant execute on function public.join_group_room(uuid,uuid) to authenticated;

alter function public.read_group_room_messages(uuid,uuid) rename to read_group_room_messages_before_privacy;
revoke all on function public.read_group_room_messages_before_privacy(uuid,uuid) from public,anon,authenticated;
create function public.read_group_room_messages(p_room_token uuid,p_member_token uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$

begin perform public.assert_private_room(p_room_token,p_member_token); return public.read_group_room_messages_before_privacy(p_room_token,p_member_token); end $$;
revoke all on function public.read_group_room_messages(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_group_room_messages(uuid,uuid) to authenticated;

alter function public.list_group_room_photos(uuid,uuid) rename to list_group_room_photos_before_privacy;
revoke all on function public.list_group_room_photos_before_privacy(uuid,uuid) from public,anon,authenticated;
create function public.list_group_room_photos(p_room_token uuid,p_member_token uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$

begin perform public.assert_private_room(p_room_token,p_member_token); return public.list_group_room_photos_before_privacy(p_room_token,p_member_token); end $$;
revoke all on function public.list_group_room_photos(uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_group_room_photos(uuid,uuid) to authenticated;

alter function public.add_group_room_photo(uuid,uuid,text,text,text,integer) rename to add_group_room_photo_before_privacy;
revoke all on function public.add_group_room_photo_before_privacy(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
create function public.add_group_room_photo(p_room_token uuid,p_member_token uuid,p_file_name text,p_storage_path text,p_mime_type text,p_size_bytes integer) returns jsonb language plpgsql security definer set search_path='' as $$

begin perform public.assert_private_room(p_room_token,p_member_token); return public.add_group_room_photo_before_privacy(p_room_token,(select m.seat_token from public.group_room_members m join public.group_rooms r on r.id=m.room_id where r.access_token=p_room_token and m.user_id=(select auth.uid())),p_file_name,p_storage_path,p_mime_type,p_size_bytes); end $$;
revoke all on function public.add_group_room_photo(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.add_group_room_photo(uuid,uuid,text,text,text,integer) to authenticated;

alter function public.plan_read(uuid,uuid) rename to plan_read_before_privacy;
revoke all on function public.plan_read_before_privacy(uuid,uuid) from public,anon,authenticated;
create function public.plan_read(p_token uuid,p_seat uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; members jsonb;
begin perform public.assert_private_plan(p_token,p_seat); result := public.plan_read_before_privacy(p_token,p_seat);
 select jsonb_agg(case when m.user_id=(select auth.uid()) then x.value else x.value-'method'-'reminders'-'days' end order by m.position) into members
 from jsonb_array_elements(result->'members') x join public.plan_members m on m.id=(x.value->>'id')::uuid;
 return result||jsonb_build_object('members',coalesce(members,'[]'::jsonb)); end $$;
revoke all on function public.plan_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.plan_read(uuid,uuid) to authenticated;

alter function public.plan_action(uuid,uuid,text,uuid,uuid,jsonb) rename to plan_action_before_privacy;
revoke all on function public.plan_action_before_privacy(uuid,uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
create function public.plan_action(p_token uuid,p_seat uuid default null,p_action text default '',p_member uuid default null,p_period uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$

begin perform public.assert_private_plan(p_token,p_seat); return public.plan_action_before_privacy(p_token,p_seat,p_action,p_member,p_period,p_data); end $$;
revoke all on function public.plan_action(uuid,uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.plan_action(uuid,uuid,text,uuid,uuid,jsonb) to authenticated;

alter function public.read_plan_messages(uuid,uuid) rename to read_plan_messages_before_privacy;
revoke all on function public.read_plan_messages_before_privacy(uuid,uuid) from public,anon,authenticated;
create function public.read_plan_messages(p_plan_token uuid,p_seat uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$

begin perform public.assert_private_plan(p_plan_token,p_seat); return public.read_plan_messages_before_privacy(p_plan_token,p_seat); end $$;
revoke all on function public.read_plan_messages(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_plan_messages(uuid,uuid) to authenticated;

-- Chat authors come from the authenticated identity, never from a missing token.
create or replace function public.add_group_room_message(p_room_token uuid,p_member_token uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.group_rooms; m public.group_room_members; msg public.group_room_messages;
begin
 perform public.assert_private_room(p_room_token,p_member_token);
 select * into r from public.group_rooms where access_token=p_room_token;
 select * into m from public.group_room_members where room_id=r.id and user_id=(select auth.uid());
 if not found then raise exception 'Use your own invitation'; end if;
 if p_body is null or char_length(trim(p_body)) not between 1 and 1000 then raise exception 'Message must be between 1 and 1000 characters'; end if;
 insert into public.group_room_messages(room_id,member_id,sender_name,body) values(r.id,m.id,m.name,trim(p_body)) returning * into msg;
 return jsonb_build_object('id',msg.id,'senderName',msg.sender_name,'body',msg.body,'createdAt',msg.created_at);
end $$;
revoke all on function public.add_group_room_message(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.add_group_room_message(uuid,uuid,text) to authenticated;
create or replace function public.add_plan_message(p_plan_token uuid,p_seat uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.monthly_plans; m public.plan_members; msg public.plan_messages;
begin
 perform public.assert_private_plan(p_plan_token,p_seat);
 select * into p from public.monthly_plans where token=p_plan_token;
 select * into m from public.plan_members where plan_id=p.id and user_id=(select auth.uid());
 if not found then raise exception 'Use your own invitation'; end if;
 if p_body is null or char_length(trim(p_body)) not between 1 and 1000 then raise exception 'Message must be between 1 and 1000 characters'; end if;
 insert into public.plan_messages(plan_id,member_id,sender_name,body) values(p.id,m.id,m.name,trim(p_body)) returning * into msg;
 return jsonb_build_object('id',msg.id,'senderName',msg.sender_name,'body',msg.body,'createdAt',msg.created_at);
end $$;
revoke all on function public.add_plan_message(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.add_plan_message(uuid,uuid,text) to authenticated;

-- Retired simulation APIs must not manufacture new paid/credit/wallet states.
revoke all on function public.update_group_member(uuid,uuid,text,text,integer),public.complete_group_room(uuid),
 public.wallet_action(text,bigint,text,uuid),public.wallet_pay(text,uuid,uuid,uuid,bigint,uuid),public.wallet_read() from public,anon,authenticated;

create function public.has_private_room(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (exists(select 1 from public.group_rooms where id=p_id and owner_id=(select auth.uid())) or exists(select 1 from public.group_room_members where room_id=p_id and user_id=(select auth.uid())));
$$;
create function public.can_read_group_photo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_room_photos p where p.storage_path=p_path and public.has_private_room(p.room_id));
$$;
create function public.can_upload_group_photo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_rooms r where r.access_token::text=split_part(p_path,'/',1) and public.has_private_room(r.id));
$$;
revoke all on function public.has_private_room(uuid),public.can_read_group_photo(text),public.can_upload_group_photo(text) from public,anon,authenticated;
grant execute on function public.has_private_room(uuid),public.can_read_group_photo(text),public.can_upload_group_photo(text) to authenticated;
update storage.buckets set public=false where id='group-photos';
drop policy if exists group_photos_upload on storage.objects;
create policy group_photos_private_upload on storage.objects for insert to authenticated
 with check(bucket_id='group-photos' and public.can_upload_group_photo(name));
create policy group_photos_private_read on storage.objects for select to authenticated
 using(bucket_id='group-photos' and public.can_read_group_photo(name));
create policy group_photos_private_remove on storage.objects for delete to authenticated
 using(bucket_id='group-photos' and owner_id=(select auth.uid())::text);

-- Owners can invalidate a participant link and remove its claimed membership.
create function public.revoke_group_invitation(p_room_token uuid,p_member_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.group_rooms where access_token=p_room_token and owner_id=(select auth.uid())) then raise exception 'Only the organiser can revoke an invitation' using errcode='42501'; end if;
 update public.group_room_members set seat_token=gen_random_uuid(),user_id=null where room_id=(select id from public.group_rooms where access_token=p_room_token) and id=p_member_id and position<>0;
 if not found then raise exception 'Participant not found'; end if;
end $$;
revoke all on function public.revoke_group_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_group_invitation(uuid,uuid) to authenticated;
create function public.revoke_plan_invitation(p_token uuid,p_member_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.monthly_plans where token=p_token and owner_id=(select auth.uid())) then raise exception 'Only the organiser can revoke an invitation' using errcode='42501'; end if;
 update public.plan_members set token=gen_random_uuid(),user_id=null,method='manual',reminders=true,reminder_days=3 where plan_id=(select id from public.monthly_plans where token=p_token) and id=p_member_id and position<>0;
 if not found then raise exception 'Participant not found'; end if;
end $$;
revoke all on function public.revoke_plan_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_plan_invitation(uuid,uuid) to authenticated;

create function public.private_schema_version() returns integer language sql stable as $$ select 1; $$;
revoke all on function public.private_schema_version() from public,anon;
grant execute on function public.private_schema_version() to authenticated;
commit;

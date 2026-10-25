-- Shared group photos. The room access token is the capability for this prototype.
create table if not exists public.group_room_photos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.group_rooms(id) on delete cascade,
  member_id uuid references public.group_room_members(id) on delete set null,
  uploader_name text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create index if not exists group_room_photos_room_time on public.group_room_photos(room_id, created_at desc);
alter table public.group_room_photos enable row level security;
revoke all on public.group_room_photos from anon, authenticated;

insert into storage.buckets(id, name, public)
values ('group-photos', 'group-photos', true)
on conflict (id) do update set public = true;

drop policy if exists group_photos_upload on storage.objects;
create policy group_photos_upload on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'group-photos'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
);

create or replace function public.list_group_room_photos(p_room_token uuid, p_member_token uuid default null)
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
    'id',p.id,'uploaderName',p.uploader_name,'fileName',p.file_name,
    'storagePath',p.storage_path,'mimeType',p.mime_type,'sizeBytes',p.size_bytes,
    'createdAt',p.created_at
  ) order by p.created_at desc) from public.group_room_photos p where p.room_id=r.id),'[]'::jsonb);
end;
$$;

create or replace function public.add_group_room_photo(
  p_room_token uuid, p_member_token uuid, p_file_name text, p_storage_path text,
  p_mime_type text, p_size_bytes integer
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare r public.group_rooms; m public.group_room_members; photo public.group_room_photos;
begin
  select * into r from public.group_rooms where access_token=p_room_token;
  if not found then raise exception 'Group not found'; end if;
  if p_member_token is not null then
    select * into m from public.group_room_members where room_id=r.id and seat_token=p_member_token;
    if not found then raise exception 'Invalid participant link'; end if;
  end if;
  if p_file_name is null or char_length(trim(p_file_name)) not between 1 and 180 then raise exception 'Invalid file name'; end if;
  if p_storage_path is null or p_storage_path not like p_room_token::text || '/%' then raise exception 'Invalid storage path'; end if;
  if p_mime_type not like 'image/%' or p_size_bytes <= 0 or p_size_bytes > 10485760 then raise exception 'Only images up to 10 MB are supported'; end if;
  insert into public.group_room_photos(room_id,member_id,uploader_name,file_name,storage_path,mime_type,size_bytes)
  values(r.id,m.id,coalesce(m.name,'Organiser'),trim(p_file_name),p_storage_path,p_mime_type,p_size_bytes) returning * into photo;
  return jsonb_build_object('id',photo.id,'uploaderName',photo.uploader_name,'fileName',photo.file_name,'storagePath',photo.storage_path,'mimeType',photo.mime_type,'sizeBytes',photo.size_bytes,'createdAt',photo.created_at);
end;
$$;

revoke all on function public.list_group_room_photos(uuid,uuid), public.add_group_room_photo(uuid,uuid,text,text,text,integer) from public;
grant execute on function public.list_group_room_photos(uuid,uuid), public.add_group_room_photo(uuid,uuid,text,text,text,integer) to anon, authenticated;

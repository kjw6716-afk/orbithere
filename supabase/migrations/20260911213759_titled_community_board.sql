-- Backward-compatible title/detail board, private photo storage and admin pins.
begin;
set local lock_timeout='5s';
alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists image_paths text[] not null default '{}';
alter table public.posts add column if not exists is_pinned boolean not null default false;
alter table public.posts add column if not exists pinned_at timestamptz;
-- Legacy rows may predate device IDs. New inserts still require auth and the
-- binding trigger; title backfill and admin pin updates must work on old rows.
alter table public.posts drop constraint if exists posts_author_device_required;
alter table public.posts add constraint posts_author_device_required
 check(author_id is null or (author_device is not null and char_length(author_device) between 8 and 64));
update public.posts set title=coalesce(nullif(left(regexp_replace(btrim(text),'[\r\n]+',' ','g'),80),''),'이전 게시글') where title is null;
alter table public.posts alter column title set not null;
alter table public.posts alter column title set default '';
alter table public.posts drop constraint if exists posts_text_check;
alter table public.posts add constraint posts_text_check check(char_length(btrim(text)) between 1 and 5000);
alter table public.posts drop constraint if exists posts_title_check;
alter table public.posts add constraint posts_title_check check(char_length(btrim(title)) between 1 and 80);
alter table public.posts drop constraint if exists posts_images_check;
alter table public.posts add constraint posts_images_check check(cardinality(image_paths)<=5 and array_position(image_paths,null) is null);
grant select(title,image_paths,is_pinned,pinned_at) on public.posts to anon,authenticated;
grant update(is_pinned,pinned_at) on public.posts to authenticated;
drop policy if exists posts_admin_update_pin on public.posts;
create policy posts_admin_update_pin on public.posts for update to authenticated
using(public.is_admin()) with check(public.is_admin());
create index if not exists posts_images_lookup on public.posts using gin(image_paths);
create index if not exists posts_pinned_order on public.posts(pinned_at desc,id desc) where is_pinned;

create table if not exists orbit_private.board_uploads(
 path text primary key, post_id uuid not null, author_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), attached boolean not null default false
);
create index if not exists board_uploads_author_time on orbit_private.board_uploads(author_id,created_at desc);
create index if not exists board_uploads_post on orbit_private.board_uploads(post_id);
alter table orbit_private.board_uploads enable row level security;
revoke all on orbit_private.board_uploads from public,anon,authenticated;

-- The Storage API owns file bytes and deletion. Only the bucket configuration
-- and access policies are provisioned here; never delete storage.objects in SQL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('board-images','board-images',false,2097152,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];

create or replace function public.reserve_board_images(p_post_id uuid,p_count integer)
returns text[] language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); paths text[]; used integer;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_count is null or p_count not between 1 and 5 or p_post_id is null then raise exception 'orbit_photo_limit'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':board_photos',0));
 if exists(select 1 from public.posts where id=p_post_id) then raise exception 'Post already exists'; end if;
 select array_agg(path order by path) into paths from orbit_private.board_uploads
 where post_id=p_post_id and author_id=actor and created_at>now()-interval '1 hour' and not attached;
 if cardinality(paths)=p_count then return paths; end if;
 if paths is not null then raise exception 'orbit_photo_retry'; end if;
 if exists(select 1 from orbit_private.board_uploads where post_id=p_post_id and author_id<>actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 select count(*) into used from orbit_private.board_uploads where author_id=actor and created_at>now()-interval '1 hour';
 if used+p_count>20 then raise exception 'orbit_photo_rate_limit'; end if;
 insert into orbit_private.board_uploads(path,post_id,author_id)
 select actor::text||'/'||p_post_id::text||'/'||gen_random_uuid()::text||'.jpg',p_post_id,actor from generate_series(1,p_count);
 select array_agg(path order by path) into paths from orbit_private.board_uploads where post_id=p_post_id and author_id=actor and not attached and created_at>now()-interval '1 hour';
 -- Expired reservations are no longer upload permissions. Physical orphan
 -- objects remain private and are removed through the moderator Storage API.
 delete from orbit_private.board_uploads where created_at<now()-interval '1 day';
 return paths;
end; $$;
revoke all on function public.reserve_board_images(uuid,integer) from public,anon;
grant execute on function public.reserve_board_images(uuid,integer) to authenticated;

create or replace function orbit_private.can_upload_board_image(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from orbit_private.board_uploads u where u.author_id=auth.uid() and not u.attached
 and u.created_at>now()-interval '1 hour'
 and (p_name=u.path or p_name=replace(u.path,'.jpg','.thumb.jpg')));
$$;
revoke all on function orbit_private.can_upload_board_image(text) from public,anon;
grant execute on function orbit_private.can_upload_board_image(text) to authenticated;
drop policy if exists board_images_insert on storage.objects;
create policy board_images_insert on storage.objects for insert to authenticated
with check(bucket_id='board-images' and orbit_private.can_upload_board_image(name));
drop policy if exists board_images_read on storage.objects;
create policy board_images_read on storage.objects for select to anon,authenticated using(
 bucket_id='board-images' and (
 exists(select 1 from public.posts p where p.image_paths @> array[regexp_replace(name,'\.thumb\.jpg$','.jpg')])
 or (storage.foldername(name))[1]=(select auth.uid())::text or public.is_admin()));
drop policy if exists board_images_delete on storage.objects;
create policy board_images_delete on storage.objects for delete to authenticated using(
 bucket_id='board-images' and ((storage.foldername(name))[1]=(select auth.uid())::text or public.is_admin())
 and not exists(select 1 from public.posts p where p.image_paths @> array[regexp_replace(name,'\.thumb\.jpg$','.jpg')]));
-- No UPDATE policy: immutable object paths and upload(upsert:false).

create or replace function orbit_private.guard_board_post()
returns trigger language plpgsql security definer set search_path='' as $$
declare upload_path text;
begin
 if tg_op='INSERT' then
  -- Cached pre-board clients have no title; preserve compatibility without
  -- changing the ownership or rate-limit checks from previous migrations.
  if btrim(coalesce(new.title,''))='' then new.title:=left(regexp_replace(btrim(new.text),'[\r\n]+',' ','g'),80); end if;
  if cardinality(new.image_paths)>5 then raise exception 'orbit_photo_limit'; end if;
  if (select count(distinct x) from unnest(new.image_paths) x)<>cardinality(new.image_paths) then raise exception 'Duplicate image'; end if;
  foreach upload_path in array new.image_paths loop
   if not exists(select 1 from orbit_private.board_uploads u where u.path=upload_path and u.post_id=new.id and u.author_id=auth.uid() and not u.attached and u.created_at>now()-interval '1 hour') then
    raise exception 'Image ownership required' using errcode='42501';
   end if;
   if not exists(select 1 from storage.objects where bucket_id='board-images' and name=upload_path)
    or not exists(select 1 from storage.objects where bucket_id='board-images' and name=replace(upload_path,'.jpg','.thumb.jpg')) then
    raise exception 'orbit_photo_missing';
   end if;
  end loop;
  update orbit_private.board_uploads set attached=true where path=any(new.image_paths);
 elsif new.image_paths is distinct from old.image_paths then
  raise exception 'Images are immutable' using errcode='42501';
 end if;
 if (tg_op='INSERT' and new.is_pinned) or (tg_op='UPDATE' and (new.is_pinned is distinct from old.is_pinned or new.pinned_at is distinct from old.pinned_at)) then
  if not public.is_admin() then raise exception 'orbit_not_admin' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orbit:board_pins',0));
  if new.is_pinned and (select count(*) from public.posts where is_pinned and id<>new.id)>=3 then raise exception 'orbit_pin_limit'; end if;
  new.pinned_at:=case when new.is_pinned then clock_timestamp() else null end;
 elsif tg_op='INSERT' then new.pinned_at:=null;
 end if;
 return new;
end; $$;
revoke all on function orbit_private.guard_board_post() from public,anon,authenticated;
drop trigger if exists c_guard_board_post on public.posts;
create trigger c_guard_board_post before insert or update on public.posts for each row execute function orbit_private.guard_board_post();

-- Idempotent create: retrying after a network timeout cannot publish twice.
create or replace function public.create_board_post(p_id uuid,p_nick text,p_title text,p_orbit text,p_text text,p_images text[] default '{}',p_pinned boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then raise exception 'orbit_title_required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 if exists(select 1 from public.posts where id=p_id) then
  if exists(select 1 from public.posts where id=p_id and author_id=auth.uid() and title=btrim(p_title) and text=btrim(p_text) and orbit=p_orbit and image_paths=p_images and is_pinned=p_pinned) then return p_id; end if;
  raise exception 'Post ID is already used';
 end if;
 insert into public.posts(id,nick,title,orbit,text,image_paths,is_pinned,author_id)
 values(p_id,p_nick,btrim(p_title),p_orbit,btrim(p_text),p_images,p_pinned,auth.uid());
 return p_id;
end; $$;
revoke all on function public.create_board_post(uuid,text,text,text,text,text[],boolean) from public,anon;
grant execute on function public.create_board_post(uuid,text,text,text,text,text[],boolean) to authenticated;

create or replace function public.board_posts(p_orbit text default null,p_query text default '',p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 21,p_pinned boolean default false)
returns table(id uuid,title text,nick text,orbit text,created_at timestamptz,author_id uuid,image_paths text[],is_pinned boolean,pinned_at timestamptz,comment_count bigint)
language sql stable security invoker set search_path='' as $$
 select p.id,p.title,p.nick,p.orbit,p.created_at,p.author_id,p.image_paths,p.is_pinned,p.pinned_at,
 (select count(*) from public.comments c where c.post_id=p.id)
 from public.posts p
 where p.is_pinned=p_pinned and (p_orbit is null or p.orbit=p_orbit)
 and (p_query='' or strpos(lower(p.title||' '||p.text),lower(left(p_query,80)))>0)
 and (p_before is null or (p.created_at,p.id)<(p_before,p_before_id))
 order by case when p_pinned then p.pinned_at end desc,p.created_at desc,p.id desc
 limit least(greatest(p_limit,1),50);
$$;
revoke all on function public.board_posts(text,text,timestamptz,uuid,integer,boolean) from public;
grant execute on function public.board_posts(text,text,timestamptz,uuid,integer,boolean) to anon,authenticated;

create or replace function public.board_orphan_images(p_limit integer default 100)
returns table(name text) language sql stable security definer set search_path='' as $$
 select o.name from storage.objects o where public.is_admin() and o.bucket_id='board-images'
 and o.created_at<now()-interval '1 day'
 and not exists(select 1 from public.posts p where p.image_paths @> array[regexp_replace(o.name,'\.thumb\.jpg$','.jpg')])
 order by o.created_at limit least(greatest(p_limit,1),100);
$$;
revoke all on function public.board_orphan_images(integer) from public,anon;
grant execute on function public.board_orphan_images(integer) to authenticated;
create or replace function public.board_version() returns integer language sql immutable set search_path='' as $$select 1;$$;
revoke all on function public.board_version() from public;
grant execute on function public.board_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;

begin;
set local lock_timeout='5s';
-- Read-only visitors and existing ownership remain valid. Only new posts/comments/photos require membership.
create or replace function orbit_members_private.require_writer() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=orbit_members_private.require_member();
begin
 if not public.is_admin() and not exists(select 1 from orbit_members_private.profiles where user_id=actor and deleting_at is null)
 then raise exception 'member_profile_required' using errcode='42501'; end if;
 return actor;
end; $$;
revoke all on function orbit_members_private.require_writer() from public,anon,authenticated;

create or replace function orbit_members_private.guard_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare p orbit_members_private.profiles;
begin
 select * into p from orbit_members_private.profiles where user_id=auth.uid() for share;
 if found and p.deleting_at is not null then raise exception 'withdrawal_in_progress' using errcode='42501'; end if;
 if tg_table_schema='public' and tg_table_name in ('posts','comments') and tg_op='INSERT' then
  perform orbit_members_private.require_writer();
  if p.user_id is not null then new.nick:=p.nickname; end if;
 end if;
 return new;
end; $$;
revoke all on function orbit_members_private.guard_write() from public,anon,authenticated;

create or replace function public.reserve_board_images(p_post_id uuid,p_count integer)
returns text[] language plpgsql security definer set search_path='' as $$
declare actor uuid:=orbit_members_private.require_writer(); paths text[]; used integer;
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


-- Old anonymous reservations cannot be used to upload after this change.
create or replace function orbit_private.can_upload_board_image(p_name text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=orbit_members_private.require_writer();
begin
 return exists(select 1 from orbit_private.board_uploads u where u.author_id=actor and not u.attached
 and u.created_at>now()-interval '1 hour'
 and (p_name=u.path or p_name=replace(u.path,'.jpg','.thumb.jpg')));
end; $$;
revoke all on function orbit_private.can_upload_board_image(text) from public,anon;
grant execute on function orbit_private.can_upload_board_image(text) to authenticated;
commit;

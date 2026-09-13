begin;
set local lock_timeout='5s';
create schema if not exists orbit_activity_private;
revoke all on schema orbit_activity_private from public,anon,authenticated;
grant usage on schema orbit_activity_private to authenticated;

-- One receipt per actually displayed reply; pagination and concurrent replies
-- cannot be skipped by a client clock or a thread-wide high-water mark.
create table if not exists orbit_activity_private.read_comments (
 user_id uuid not null references auth.users(id) on delete cascade,
 comment_id uuid not null references public.comments(id) on delete cascade,
 primary key(user_id,comment_id)
);
alter table orbit_activity_private.read_comments enable row level security;
revoke all on orbit_activity_private.read_comments from public,anon,authenticated;
grant select on orbit_activity_private.read_comments to authenticated;
drop policy if exists read_comments_self on orbit_activity_private.read_comments;
create policy read_comments_self on orbit_activity_private.read_comments
 for select to authenticated using(user_id=(select auth.uid()));
create index if not exists read_comments_comment on orbit_activity_private.read_comments(comment_id);
create index if not exists comments_activity_author on public.comments(author_id,post_id,created_at,id);
create index if not exists posts_activity_author on public.posts(author_id,created_at desc,id desc);

create or replace function orbit_activity_private.unread_comment_ids(p_post_id uuid)
returns table(id uuid) language sql stable security invoker set search_path='' as $$
 select c.id from public.comments c join public.posts p on p.id=c.post_id
 where p.id=p_post_id and (select auth.uid()) is not null
 and c.author_id is distinct from (select auth.uid())
 and (p.author_id=(select auth.uid()) or exists(
  select 1 from public.comments own where own.post_id=p.id and own.author_id=(select auth.uid())
  and (own.created_at,own.id)<(c.created_at,c.id)
 ))
 and not exists(select 1 from orbit_activity_private.read_comments r
  where r.user_id=(select auth.uid()) and r.comment_id=c.id);
$$;
revoke all on function orbit_activity_private.unread_comment_ids(uuid) from public,anon,authenticated;
grant execute on function orbit_activity_private.unread_comment_ids(uuid) to authenticated;

-- Only this bounded, membership-checked helper may add receipts. The actor
-- always comes from the verified session, never a request parameter.
create or replace function orbit_activity_private.mark_comments_read(p_post_id uuid,p_comment_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); accepted integer;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if coalesce(cardinality(p_comment_ids),0)>50 then raise exception 'Too many comments' using errcode='22023'; end if;
 perform 1 from public.posts where id=p_post_id for key share;
 if not found then return 0; end if;
 -- Lock the selected comments against deletion until their receipts exist.
 perform 1 from public.comments c where c.post_id=p_post_id and c.id=any(p_comment_ids) for key share;
 insert into orbit_activity_private.read_comments(user_id,comment_id)
 select actor,u.id from orbit_activity_private.unread_comment_ids(p_post_id) u
 where u.id=any(p_comment_ids)
 on conflict do nothing;
 get diagnostics accepted=row_count;
 return accepted;
end; $$;
revoke all on function orbit_activity_private.mark_comments_read(uuid,uuid[]) from public,anon,authenticated;
grant execute on function orbit_activity_private.mark_comments_read(uuid,uuid[]) to authenticated;

create or replace function public.mark_board_comments_read(p_post_id uuid,p_comment_ids uuid[])
returns integer language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.posts where id=p_post_id) then return 0; end if;
 return orbit_activity_private.mark_comments_read(p_post_id,p_comment_ids);
end; $$;
revoke all on function public.mark_board_comments_read(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.mark_board_comments_read(uuid,uuid[]) to authenticated;

create or replace function public.board_activity_posts(
 p_scope text default 'mine',p_query text default '',p_before timestamptz default null,
 p_before_id uuid default null,p_limit integer default 21)
returns table(id uuid,title text,nick text,orbit text,created_at timestamptz,author_id uuid,
 image_paths text[],is_pinned boolean,pinned_at timestamptz,comment_count bigint,view_count bigint,unread_count bigint)
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_scope is null or p_scope not in ('mine','joined','unread') then raise exception 'Invalid activity scope' using errcode='22023'; end if;
 return query
 with candidates as (
  select p.id from public.posts p where p.author_id=(select auth.uid()) and p_scope in ('mine','unread')
  union
  select c.post_id from public.comments c join public.posts p on p.id=c.post_id
  where c.author_id=(select auth.uid()) and p.author_id is distinct from (select auth.uid()) and p_scope in ('joined','unread')
 )
 select p.id,p.title,p.nick,p.orbit,p.created_at,p.author_id,p.image_paths,p.is_pinned,p.pinned_at,
 (select count(*) from public.comments c where c.post_id=p.id),coalesce(v.view_count,0),unread.n
 from candidates x join public.posts p on p.id=x.id
 left join public.post_view_counts v on v.post_id=p.id
 cross join lateral (select count(*) as n from orbit_activity_private.unread_comment_ids(p.id)) unread
 where (p_scope<>'unread' or unread.n>0)
 and (coalesce(p_query,'')='' or strpos(lower(p.title||' '||p.text||' '||coalesce(case p.observation->>'method'
  when 'naked-eye' then '맨눈' when 'phone' then '휴대폰' when 'binoculars' then '쌍안경' when 'telescope' then '망원경' end,'')),lower(left(p_query,80)))>0
  or exists(select 1 from jsonb_each_text(p.observation) item where strpos(lower(item.value),lower(left(p_query,80)))>0))
 and (p_before is null or (p.created_at,p.id)<(p_before,p_before_id))
 order by p.created_at desc,p.id desc limit least(greatest(p_limit,1),50);
end; $$;
revoke all on function public.board_activity_posts(text,text,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.board_activity_posts(text,text,timestamptz,uuid,integer) to authenticated;

create or replace function public.board_activity_summary()
returns bigint language plpgsql stable security invoker set search_path='' as $$
declare total bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 with candidates as (
  select p.id from public.posts p where p.author_id=(select auth.uid())
  union select c.post_id from public.comments c where c.author_id=(select auth.uid())
 )
 select count(*) into total from (
  select x.id from candidates x join public.posts p on p.id=x.id
  where exists(select 1 from orbit_activity_private.unread_comment_ids(p.id)) limit 100
 ) unread_threads;
 return total;
end; $$;
revoke all on function public.board_activity_summary() from public,anon,authenticated;
grant execute on function public.board_activity_summary() to authenticated;
notify pgrst,'reload schema';
commit;

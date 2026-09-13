-- Count real detail opens once per authenticated browser/post per 30 minutes.
begin;
set local lock_timeout='5s';
create table if not exists public.post_view_counts (
 post_id uuid primary key references public.posts(id) on delete cascade,
 view_count bigint not null default 0 check(view_count>=0)
);
alter table public.post_view_counts enable row level security;
revoke all on public.post_view_counts from public,anon,authenticated;
grant select on public.post_view_counts to anon,authenticated;
drop policy if exists post_view_counts_read on public.post_view_counts;
create policy post_view_counts_read on public.post_view_counts for select to anon,authenticated
 using(exists(select 1 from public.posts p where p.id=post_id));
-- Supports a future popularity query without retaining permanent viewer histories.
create index if not exists post_view_counts_popular on public.post_view_counts(view_count desc,post_id);

-- Isolate this callable helper from the pre-existing private schema.
create schema if not exists orbit_view_private;
revoke all on schema orbit_view_private from public,anon,authenticated;
grant usage on schema orbit_view_private to authenticated;
create table if not exists orbit_view_private.recent_views (
 post_id uuid not null references public.posts(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 viewed_at timestamptz not null default now(),
 primary key(post_id,viewer_id)
);
alter table orbit_view_private.recent_views enable row level security;
revoke all on orbit_view_private.recent_views from public,anon,authenticated;
create index if not exists recent_views_expiry on orbit_view_private.recent_views(viewed_at);
create index if not exists recent_views_viewer on orbit_view_private.recent_views(viewer_id);

create or replace function orbit_view_private.record_post_view(p_post_id uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); accepted integer; total bigint;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_post_id is null then return null; end if;
 -- The current board is public. Hold the parent row until counting completes,
 -- so a simultaneous deletion cannot leave orphan counters or viewer records.
 perform 1 from public.posts where id=p_post_id for key share;
 if not found then return null; end if;
 insert into orbit_view_private.recent_views(post_id,viewer_id,viewed_at)
 values(p_post_id,actor,now())
 on conflict(post_id,viewer_id) do update set viewed_at=excluded.viewed_at
 where orbit_view_private.recent_views.viewed_at<=now()-interval '30 minutes';
 get diagnostics accepted=row_count;
 if accepted=1 then
  insert into public.post_view_counts(post_id,view_count) values(p_post_id,1)
  on conflict(post_id) do update set view_count=public.post_view_counts.view_count+1
  returning view_count into total;
 else
  select view_count into total from public.post_view_counts where post_id=p_post_id;
 end if;
 -- Bounded indexed cleanup comes last; skip in-flight rows instead of blocking
 -- another viewer. No viewer information is available through the public API.
 delete from orbit_view_private.recent_views where (post_id,viewer_id) in (
  select v.post_id,v.viewer_id from orbit_view_private.recent_views v
  where v.viewed_at<=now()-interval '30 minutes'
  order by v.viewed_at limit 500 for update skip locked
 );
 return coalesce(total,0);
end; $$;
revoke all on function orbit_view_private.record_post_view(uuid) from public,anon,authenticated;
grant execute on function orbit_view_private.record_post_view(uuid) to authenticated;
create or replace function public.record_post_view(p_post_id uuid)
returns bigint language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.posts where id=p_post_id) then return null; end if;
 return orbit_view_private.record_post_view(p_post_id);
end; $$;
revoke all on function public.record_post_view(uuid) from public,anon,authenticated;
grant execute on function public.record_post_view(uuid) to authenticated;

-- PostgreSQL requires replacement when appending a returned column. The same
-- signature/defaults and all existing fields remain compatible with cached UI.
drop function if exists public.board_posts(text,text,timestamptz,uuid,integer,boolean);
create function public.board_posts(p_orbit text default null,p_query text default '',p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 21,p_pinned boolean default false)
returns table(id uuid,title text,nick text,orbit text,created_at timestamptz,author_id uuid,image_paths text[],is_pinned boolean,pinned_at timestamptz,comment_count bigint,view_count bigint)
language sql stable security invoker set search_path='' as $$
 select p.id,p.title,p.nick,p.orbit,p.created_at,p.author_id,p.image_paths,p.is_pinned,p.pinned_at,
 (select count(*) from public.comments c where c.post_id=p.id),coalesce(v.view_count,0)
 from public.posts p left join public.post_view_counts v on v.post_id=p.id
 where p.is_pinned=p_pinned and (p_orbit is null or p.orbit=p_orbit)
 and (p_query='' or strpos(lower(p.title||' '||p.text),lower(left(p_query,80)))>0)
 and (p_before is null or (p.created_at,p.id)<(p_before,p_before_id))
 order by case when p_pinned then p.pinned_at end desc,p.created_at desc,p.id desc
 limit least(greatest(p_limit,1),50);
$$;
revoke all on function public.board_posts(text,text,timestamptz,uuid,integer,boolean) from public;
grant execute on function public.board_posts(text,text,timestamptz,uuid,integer,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;

-- Optional notes: retain plain post bodies and the original create RPC.
begin;
set local lock_timeout='5s';
alter table public.posts add column if not exists observation jsonb not null default '{}';
create schema if not exists orbit_observation_private;
revoke all on schema orbit_observation_private from public,anon,authenticated;
grant usage on schema orbit_observation_private to authenticated;

create or replace function orbit_observation_private.valid_board_observation(record jsonb)
returns boolean language sql immutable security invoker set search_path='' as $$
 select case when record is null or jsonb_typeof(record)<>'object' then false else
  not exists (
   select 1 from jsonb_each(record) item
   where item.key not in ('method','observed_at','location','target','direction','telescope','mount','camera','filter','exposure','processing')
    or jsonb_typeof(item.value)<>'string'
    or char_length(btrim(item.value#>>'{}')) not between 1 and 120
    or (item.key='method' and item.value#>>'{}' not in ('naked-eye','phone','binoculars','telescope'))
  ) end;
$$;
revoke all on function orbit_observation_private.valid_board_observation(jsonb) from public,anon,authenticated;
grant execute on function orbit_observation_private.valid_board_observation(jsonb) to authenticated;
alter table public.posts drop constraint if exists posts_observation_check;
alter table public.posts add constraint posts_observation_check check(orbit_observation_private.valid_board_observation(observation));
grant select(observation) on public.posts to anon,authenticated;
-- No UPDATE grant: a stored observation is as immutable as the existing body.

create or replace function public.create_observation_post(
 p_id uuid,p_nick text,p_title text,p_orbit text,p_text text,
 p_images text[] default '{}',p_pinned boolean default false,p_observation jsonb default '{}'
) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then raise exception 'orbit_title_required'; end if;
 if not orbit_observation_private.valid_board_observation(p_observation) then raise exception 'orbit_observation_invalid' using errcode='23514'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 if exists(select 1 from public.posts where id=p_id) then
  if exists(select 1 from public.posts where id=p_id and author_id=auth.uid() and title=btrim(p_title)
   and text=btrim(p_text) and orbit=p_orbit and image_paths=p_images and is_pinned=p_pinned
   and observation=p_observation) then return p_id; end if;
  raise exception 'Post ID is already used';
 end if;
 insert into public.posts(id,nick,title,orbit,text,image_paths,is_pinned,author_id,observation)
 values(p_id,p_nick,btrim(p_title),p_orbit,btrim(p_text),p_images,p_pinned,auth.uid(),p_observation);
 return p_id;
end; $$;
revoke all on function public.create_observation_post(uuid,text,text,text,text,text[],boolean,jsonb) from public,anon,authenticated;
grant execute on function public.create_observation_post(uuid,text,text,text,text,text[],boolean,jsonb) to authenticated;

-- Search the supplied values as part of a post, without exposing private data
-- or changing the list columns/cursors used by cached clients.
create or replace function public.board_posts(p_orbit text default null,p_query text default '',p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 21,p_pinned boolean default false)
returns table(id uuid,title text,nick text,orbit text,created_at timestamptz,author_id uuid,image_paths text[],is_pinned boolean,pinned_at timestamptz,comment_count bigint,view_count bigint)
language sql stable security invoker set search_path='' as $$
 select p.id,p.title,p.nick,p.orbit,p.created_at,p.author_id,p.image_paths,p.is_pinned,p.pinned_at,
 (select count(*) from public.comments c where c.post_id=p.id),coalesce(v.view_count,0)
 from public.posts p left join public.post_view_counts v on v.post_id=p.id
 where p.is_pinned=p_pinned and (p_orbit is null or p.orbit=p_orbit)
 and (p_query='' or strpos(lower(p.title||' '||p.text||' '||coalesce(case p.observation->>'method'
  when 'naked-eye' then '맨눈' when 'phone' then '휴대폰' when 'binoculars' then '쌍안경' when 'telescope' then '망원경' end,'')),lower(left(p_query,80)))>0
  or exists(select 1 from jsonb_each_text(p.observation) item where strpos(lower(item.value),lower(left(p_query,80)))>0))
 and (p_before is null or (p.created_at,p.id)<(p_before,p_before_id))
 order by case when p_pinned then p.pinned_at end desc,p.created_at desc,p.id desc
 limit least(greatest(p_limit,1),50);
$$;
revoke all on function public.board_posts(text,text,timestamptz,uuid,integer,boolean) from public;
grant execute on function public.board_posts(text,text,timestamptz,uuid,integer,boolean) to anon,authenticated;
create or replace function public.board_observation_version()
returns integer language sql immutable security invoker set search_path='' as $$select 1;$$;
revoke all on function public.board_observation_version() from public;
grant execute on function public.board_observation_version() to anon,authenticated;
notify pgrst,'reload schema';
commit;

begin;
set local lock_timeout = '5s';

-- Article counts only: no account/device ID, raw session ID, IP, URL or headers.
-- This schema must not be added to the Data API's exposed schemas.
create schema if not exists orbit_story_private;
revoke all on schema orbit_story_private from public, anon, authenticated, service_role;
grant usage on schema orbit_story_private to anon, authenticated;
alter default privileges in schema orbit_story_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema orbit_story_private revoke execute on functions from public, anon, authenticated, service_role;

-- Only the owner publication workflow registers actual published article IDs.
-- Re-registration must preserve tracking_started_at; titles stay in the ledger.
create table if not exists orbit_story_private.catalogue (
  story_id text primary key check (char_length(story_id) between 1 and 70 and story_id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  published_on date not null,
  tracking_started_at timestamptz not null default clock_timestamp()
);
create table if not exists orbit_story_private.daily (
  day date not null,
  story_id text not null references orbit_story_private.catalogue(story_id),
  views bigint not null check (views >= 0),
  primary key(day, story_id)
);
create table if not exists orbit_story_private.recent_views (
  day date not null,
  story_id text not null references orbit_story_private.catalogue(story_id),
  token bytea not null check (octet_length(token) = 32),
  primary key(day, story_id, token)
);
alter table orbit_story_private.catalogue enable row level security;
alter table orbit_story_private.daily enable row level security;
alter table orbit_story_private.recent_views enable row level security;
revoke all on all tables in schema orbit_story_private from public, anon, authenticated, service_role;

create or replace function orbit_story_private.record_view(p_story_id text, p_session_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  received timestamptz := pg_catalog.clock_timestamp();
  kst_day date := (received at time zone 'Asia/Seoul')::date;
  headers jsonb := coalesce(nullif(pg_catalog.current_setting('request.headers', true), ''), '{}')::jsonb;
  inserted boolean;
begin
  if p_story_id is null or pg_catalog.char_length(p_story_id) not between 1 and 70
    or p_story_id !~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
    or p_session_id is null
    or p_session_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or not exists(select 1 from orbit_story_private.catalogue c
      where c.story_id = p_story_id and c.published_on <= kst_day
        and c.tracking_started_at <= received) then
    raise exception 'invalid_story_view' using errcode = '22023';
  end if;
  -- Do not send account bearer tokens from the browser. This is a second guard
  -- for callers which nevertheless supply an authenticated administrator token.
  if exists(select 1 from public.admins where user_id = auth.uid()) then return false; end if;
  if p_session_id = auth.uid() then
    raise exception 'auth_id_is_not_a_session_id' using errcode = '22023';
  end if;
  -- Untrusted headers are an exclusion hint, never identity or authorization.
  -- Nothing from headers (including their IP / user-agent values) is persisted.
  if pg_catalog.jsonb_typeof(headers) <> 'object'
    or coalesce(headers->>'origin', '') not in ('', 'https://orbithere.com', 'https://www.orbithere.com')
    or coalesce(headers->>'user-agent', '') ~* '(bot|crawler|spider|headless|playwright|puppeteer|lighthouse)'
    or coalesce(headers->>'x-orbit-test', '') <> ''
    or coalesce(headers->>'purpose', '') ~* '(prefetch|prerender)'
    or coalesce(headers->>'sec-purpose', '') ~* '(prefetch|prerender)' then
    return false;
  end if;

  -- A token changes with the article and KST day. This stores no raw session
  -- or account identifier and no reusable cross-article token.
  insert into orbit_story_private.recent_views(day, story_id, token)
    values (kst_day, p_story_id, pg_catalog.sha256(pg_catalog.convert_to(
      p_story_id || '|' || kst_day::text || '|' || p_session_id::text, 'UTF8')))
    on conflict do nothing returning true into inserted;
  if not coalesce(inserted, false) then return false; end if;

  -- Both writes share this transaction: retries / competing calls count once.
  insert into orbit_story_private.daily as d(day, story_id, views)
    values(kst_day, p_story_id, 1)
    on conflict(day, story_id) do update set views = d.views + 1;
  -- At most the current and previous KST days; hourly cron handles quiet days.
  delete from orbit_story_private.recent_views where day < kst_day - 1;
  return true;
end; $$;
revoke all on function orbit_story_private.record_view(text, uuid) from public, anon, authenticated, service_role;
grant execute on function orbit_story_private.record_view(text, uuid) to anon, authenticated;

create or replace function public.record_story_view(p_story_id text, p_session_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select orbit_story_private.record_view(p_story_id, p_session_id)
$$;
revoke all on function public.record_story_view(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_story_view(text, uuid) to anon, authenticated;

-- Owner-only maintenance. No report, catalogue-write or purge RPC is exposed.
create or replace function orbit_story_private.purge_recent_views()
returns bigint language sql security invoker set search_path = '' as $$
  with removed as (
    delete from orbit_story_private.recent_views
      where day < (pg_catalog.clock_timestamp() at time zone 'Asia/Seoul')::date - 1
      returning 1
  ) select count(*) from removed
$$;
revoke all on function orbit_story_private.purge_recent_views() from public, anon, authenticated, service_role;

do $outer$
begin
  if exists(select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
  if pg_catalog.to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('orbit-story-view-retention', '7 * * * *',
      'select orbit_story_private.purge_recent_views()');
  end if;
end $outer$;
notify pgrst, 'reload schema';
commit;

-- Apply after migration_011_authenticated_ownership.sql. No content is deleted.
-- Track successful writes separately so deleting content cannot reset limits.
begin;
set local lock_timeout = '5s';

create schema if not exists orbit_private;
revoke all on schema orbit_private from public, anon, authenticated;
create table if not exists orbit_private.write_events (
  actor uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('posts','comments','reports')),
  source_id uuid not null,
  occurred_at timestamptz not null,
  primary key (kind, source_id, occurred_at)
);
alter table orbit_private.write_events enable row level security;
revoke all on orbit_private.write_events from public, anon, authenticated;
create index if not exists write_events_actor_kind_time
  on orbit_private.write_events(actor, kind, occurred_at desc);
create index if not exists write_events_expiry
  on orbit_private.write_events(occurred_at);

-- Preserve the active limits during rollout; repeated application is harmless.
insert into orbit_private.write_events(actor,kind,source_id,occurred_at)
select author_id,'posts',id,created_at from public.posts
 where author_id is not null and created_at > now() - interval '1 hour'
union all
select author_id,'comments',id,created_at from public.comments
 where author_id is not null and created_at > now() - interval '1 hour'
union all
select author_id,'reports',id,created_at from public.reports
 where author_id is not null and created_at > now() - interval '1 hour'
on conflict do nothing;

create or replace function orbit_private.limit_community_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  writer uuid := auth.uid();
  issued_at timestamptz;
  minute_limit integer;
  hour_limit integer;
  error_message text;
  minute_count bigint;
  hour_count bigint;
begin
  if writer is null or new.author_id is distinct from writer then
    raise exception 'Authenticated author required' using errcode = '42501';
  end if;
  case tg_table_name
    when 'posts' then minute_limit := 3; hour_limit := 20; error_message := 'orbit_rate_limit';
    when 'comments' then minute_limit := 5; hour_limit := 50; error_message := 'orbit_comment_rate_limit';
    when 'reports' then minute_limit := 5; hour_limit := 30; error_message := 'orbit_report_rate_limit';
    else raise exception 'Unexpected community table';
  end case;

  -- Serialize writes from the same authenticated author, including requests
  -- arriving at the same time. Do not trust caller-supplied device IDs or dates.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(writer::text || ':' || tg_table_name, 0));
  issued_at := clock_timestamp();
  select count(*) filter (where occurred_at > issued_at - interval '1 minute'), count(*)
    into minute_count, hour_count
    from orbit_private.write_events
   where actor = writer and kind = tg_table_name
     and occurred_at > issued_at - interval '1 hour';
  if minute_count >= minute_limit or hour_count >= hour_limit then
    raise exception '%', error_message;
  end if;

  -- A failed INSERT rolls this back too. Store only IDs, kind and time, no text.
  new.created_at := issued_at;
  insert into orbit_private.write_events(actor,kind,source_id,occurred_at)
    values(writer,tg_table_name,new.id,issued_at);
  -- Expired events disappear on the next successful community write, even if
  -- the original author never returns. No scheduled cleanup is assumed.
  delete from orbit_private.write_events where occurred_at <= issued_at - interval '1 hour';
  return new;
end;
$$;
revoke all on function orbit_private.limit_community_write() from public, anon, authenticated;

drop trigger if exists posts_rate_limit on public.posts;
drop trigger if exists comments_rate_limit on public.comments;
drop trigger if exists reports_rate_limit on public.reports;
do $$
declare t text;
begin
  foreach t in array array['posts','comments','reports'] loop
    execute format('drop trigger if exists b_limit_community_write on public.%I',t);
    execute format('create trigger b_limit_community_write before insert on public.%I for each row execute function orbit_private.limit_community_write()',t);
  end loop;
end;
$$;
revoke all on function public.posts_rate_limit(), public.comments_rate_limit(), public.reports_rate_limit()
  from public, anon, authenticated;

-- Administrative functions still check is_admin internally. Restrict their
-- entry points as well; anonymous-auth users are authenticated, not admins.
revoke all on function public.report_queue(), public.resolve_report(uuid,boolean), public.visit_stats()
  from public, anon;
grant execute on function public.report_queue(), public.resolve_report(uuid,boolean), public.visit_stats()
  to authenticated;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end; $$;

-- Match the stable (created_at,id) cursor used by the feed and comment threads.
create index if not exists posts_feed_cursor on public.posts(created_at desc,id desc);
create index if not exists posts_orbit_cursor on public.posts(orbit,created_at desc,id desc);
create index if not exists comments_thread_cursor on public.comments(post_id,created_at desc,id desc);
notify pgrst, 'reload schema';
commit;

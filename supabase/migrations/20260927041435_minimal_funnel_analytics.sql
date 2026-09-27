begin;
set local lock_timeout = '5s';

-- Browser observations are separate from visits, membership and permissions.
-- No Auth/device identifier, free text, URL, IP or user agent is stored here.
create schema if not exists orbit_funnel_private;
revoke all on schema orbit_funnel_private from public, anon, authenticated;
grant usage on schema orbit_funnel_private to anon, authenticated, service_role;

create table if not exists orbit_funnel_private.events (
  session_id uuid not null,
  sequence smallint not null check (sequence between 1 and 128),
  event text not null check (event in ('session_start','feature_view','tool_ready','tool_use','board_enter','write_start','auth_open','auth_attempt')),
  feature text not null check (feature in ('home','planets','calendar','board','guide','stories','story','news','about','policy','other')),
  detail text not null,
  context text not null check (context in ('direct','embed')),
  page_key text not null,
  audience text not null check (audience in ('guest','member')),
  occurred_at timestamptz not null default clock_timestamp(),
  primary key (session_id, sequence),
  check (length(detail) <= 20)
);
-- Authentication may be observed both before and after writing. Sequence retries
-- remain idempotent; semantic dedupe of auth phases is the client's bounded job.
create unique index if not exists funnel_semantic_dedupe on orbit_funnel_private.events(session_id,event,feature,detail)
  where event not in ('auth_open','auth_attempt');
create unique index if not exists funnel_one_start on orbit_funnel_private.events(session_id) where event='session_start';
create unique index if not exists funnel_one_write on orbit_funnel_private.events(session_id) where event='write_start';
create index if not exists funnel_event_expiry on orbit_funnel_private.events(occurred_at);
create table if not exists orbit_funnel_private.daily (
  day date primary key,
  metrics jsonb not null,
  finalized_at timestamptz not null default clock_timestamp()
);
create table if not exists orbit_funnel_private.settings (
  singleton boolean primary key default true check (singleton),
  installed_at timestamptz not null default clock_timestamp()
);
insert into orbit_funnel_private.settings(singleton) values(true) on conflict do nothing;
alter table orbit_funnel_private.events enable row level security;
alter table orbit_funnel_private.daily enable row level security;
alter table orbit_funnel_private.settings enable row level security;
revoke all on all tables in schema orbit_funnel_private from public, anon, authenticated, service_role;

create or replace function orbit_funnel_private.record_event(p_event jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid; seq integer; ev text; feat text; val text; ctx text; page text; aud text;
  received timestamptz:=clock_timestamp(); first_received timestamptz; first_audience text;
begin
  if p_event is null or jsonb_typeof(p_event)<>'object' or octet_length(p_event::text)>512
    or not (p_event ?& array['session_id','sequence','event','feature','detail','context','page_key','audience'])
    or (select count(*) from jsonb_object_keys(p_event))<>8 then
    raise exception 'invalid_funnel_payload' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_event) x where
      (x.key='sequence' and jsonb_typeof(x.value)<>'number') or
      (x.key<>'sequence' and jsonb_typeof(x.value)<>'string'))
    or p_event->>'sequence' !~ '^[0-9]{1,3}$'
    or p_event->>'session_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid_funnel_types' using errcode='22023';
  end if;
  sid:=(p_event->>'session_id')::uuid; seq:=(p_event->>'sequence')::integer;
  ev:=p_event->>'event'; feat:=p_event->>'feature'; val:=p_event->>'detail'; ctx:=p_event->>'context';
  page:=p_event->>'page_key'; aud:=p_event->>'audience';
  if seq not between 1 and 128 or feat not in ('home','planets','calendar','board','guide','stories','story','news','about','policy','other')
    or ctx not in ('direct','embed') or aud not in ('guest','member') or (ctx='embed' and feat not in ('planets','calendar','board'))
    or (ctx='embed') is distinct from (page in ('main_planets','main_calendar','main_board'))
    or not (case feat
      when 'home' then page='home'
      when 'planets' then page in ('planets','main_planets')
      when 'calendar' then page in ('calendar','main_calendar')
      when 'board' then page in ('board','main_board')
      when 'guide' then page in ('guide','reading_sky')
      when 'stories' then page='stories'
      when 'story' then page in ('story_other','are-shooting-stars-stars','cosmic-voids','how-gravity-assists-work','is-mars-all-red','iss-visible-at-dawn-and-dusk','moon-face-and-phases','seasonal-constellations-camping','why-planets-go-retrograde','why-stars-twinkle','why-venus-is-hottest')
      when 'news' then page='news'
      when 'about' then page='about'
      when 'policy' then page in ('policy','terms')
      when 'other' then page='other'
      else false end)
    or not (case ev
      when 'session_start' then seq=1 and val in ('google','naver','other_search','external','internal','unattributed')
      when 'feature_view' then seq>1 and val='none'
      when 'tool_ready' then seq>1 and feat in ('planets','calendar') and val='none'
      when 'tool_use' then seq>1 and ((feat='planets' and val in ('time','region')) or (feat='calendar' and val='filter'))
      when 'board_enter' then seq>1 and feat='board' and val in ('landing','home','planets','calendar','guide','stories','story','news','about','policy','other')
      when 'write_start' then seq>1 and feat='board' and val in ('explicit','input')
      when 'auth_open' then seq>1 and val in ('login','signup')
      when 'auth_attempt' then seq>1 and val in ('email_login','email_signup','google')
      else false end) then
    raise exception 'invalid_funnel_value' using errcode='22023';
  end if;
  -- An existing bearer token can identify an admin; apikey-only requests cannot.
  if exists(select 1 from public.admins where user_id=auth.uid()) then return; end if;
  if sid=auth.uid() then raise exception 'auth_id_is_not_a_session_id' using errcode='22023'; end if;
  -- The UUID is untrusted, short-lived dedupe state, never authorization.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(sid::text, 84721));
  select min(occurred_at) into first_received from orbit_funnel_private.events where session_id=sid;
  select audience into first_audience from orbit_funnel_private.events where session_id=sid limit 1;
  if first_received is not null and (first_received at time zone 'Asia/Seoul')::date<>(received at time zone 'Asia/Seoul')::date then
    raise exception 'new_kst_day_requires_new_session' using errcode='22023';
  end if;
  if first_audience is not null and first_audience<>aud then
    raise exception 'session_audience_is_frozen' using errcode='22023';
  end if;
  -- Accept transport reordering. Reports count only sessions with a received start.
  -- A session can add at most 128 distinct sequence numbers, with semantic dedupe.
  insert into orbit_funnel_private.events(session_id,sequence,event,feature,detail,context,page_key,audience,occurred_at)
    values(sid,seq,ev,feat,val,ctx,page,aud,received) on conflict do nothing;
end; $$;
revoke all on function orbit_funnel_private.record_event(jsonb) from public, anon, authenticated, service_role;
grant execute on function orbit_funnel_private.record_event(jsonb) to anon, authenticated;
create or replace function public.record_funnel_event(p_event jsonb)
returns void language sql security invoker set search_path='' as $$ select orbit_funnel_private.record_event(p_event) $$;
revoke all on function public.record_funnel_event(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.record_funnel_event(jsonb) to anon, authenticated;

create or replace function orbit_funnel_private.require_operator()
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if current_setting('role',true) is distinct from 'service_role' and not exists(select 1 from public.admins where user_id=auth.uid()) then
    raise exception 'operator_required' using errcode='42501';
  end if;
end; $$;
revoke all on function orbit_funnel_private.require_operator() from public, anon, authenticated, service_role;

-- ID-free daily facts: counts are session counts, not distinct people. Conversion
-- steps use client sequence, because asynchronous HTTP receipt order can differ.
create or replace function orbit_funnel_private.compute_day(p_day date)
returns jsonb language sql stable security definer set search_path='' as $$
with e as (
  select * from orbit_funnel_private.events
  where occurred_at >= p_day::timestamp at time zone 'Asia/Seoul'
    and occurred_at < (p_day+1)::timestamp at time zone 'Asia/Seoul'
), s as (
  select session_id,feature as landing,detail as source,context,page_key,audience from e where event='session_start'
), feature_names(feature) as (
  values ('home'),('planets'),('calendar'),('board'),('guide'),('stories'),('story'),('news'),('about'),('policy'),('other')
), steps as (
  select s.session_id,f.feature,
    min(e.sequence) filter(where e.event='feature_view' and e.feature=f.feature) as viewed,
    min(e.sequence) filter(where e.event='tool_ready' and e.feature=f.feature) as ready,
    min(e.sequence) filter(where e.event='board_enter' and e.detail=f.feature) as to_board
  from s cross join feature_names f left join e on e.session_id=s.session_id group by s.session_id,f.feature
), paths as (
  select s.session_id,
    min(e.sequence) filter(where e.event='feature_view' and e.feature='board') as board,
    min(e.sequence) filter(where e.event='write_start') as writing,
    bool_or(e.event='auth_open') as opened_auth,
    bool_or(e.event='auth_attempt') as attempted_auth
  from s left join e on e.session_id=s.session_id group by s.session_id
), feature_counts as (
  select f.feature,count(*) filter(where t.viewed is not null) as viewed,
    count(*) filter(where t.ready>t.viewed) as ready_after_view,
    count(*) filter(where t.ready>t.viewed and exists(select 1 from e where e.session_id=t.session_id
      and e.feature=t.feature and e.event='tool_use' and e.sequence>t.ready)) as used_after_ready,
    count(*) filter(where t.to_board>t.viewed) as board_after_view
  from feature_names f left join steps t on t.feature=f.feature group by f.feature
)
select jsonb_build_object(
  'sessions',(select count(*) from s),
  'guest_sessions',(select count(*) from s where audience='guest'),
  'member_sessions',(select count(*) from s where audience='member'),
  'raw_events',(select count(*) from e),
  'events_without_session_start',(select count(*) from e where not exists(select 1 from s where s.session_id=e.session_id)),
  'sources',(select jsonb_object_agg(source,n) from (select k.source,count(s.session_id) as n from
    (values ('google'),('naver'),('other_search'),('external'),('internal'),('unattributed')) k(source)
    left join s on s.source=k.source group by k.source) z),
  'landings',(select jsonb_object_agg(feature,n) from (select f.feature,count(s.session_id) as n from feature_names f
    left join s on s.landing=f.feature group by f.feature) z),
  'landing_pages',coalesce((select jsonb_object_agg(page_key,n) from (select page_key,count(*) as n from s group by page_key) z),'{}'::jsonb),
  'features',(select jsonb_object_agg(feature,jsonb_build_object('view_sessions',viewed,
    'ready_after_view_sessions',ready_after_view,'used_after_ready_sessions',used_after_ready,
    'board_after_view_sessions',board_after_view)) from feature_counts),
  'board_view_sessions',(select count(*) from paths where board is not null),
  'write_start_sessions',(select count(*) from paths where writing is not null),
  'write_after_board_sessions',(select count(*) from paths where writing>board),
  'auth_open_sessions',(select count(*) from paths where opened_auth),
  'auth_attempt_sessions',(select count(*) from paths where attempted_auth),
  'auth_open_after_write_sessions',(select count(*) from paths p where writing is not null and exists(
    select 1 from e where e.session_id=p.session_id and e.event='auth_open' and e.sequence>p.writing)),
  'auth_attempt_after_write_sessions',(select count(*) from paths p where writing is not null and exists(
    select 1 from e where e.session_id=p.session_id and e.event='auth_attempt' and e.sequence>p.writing))
); $$;
revoke all on function orbit_funnel_private.compute_day(date) from public, anon, authenticated, service_role;

create or replace function orbit_funnel_private.maintain()
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date; first_day date;
  d date; rolled integer:=0; removed integer; removed_daily integer;
begin
  -- Serialize manual/scheduled maintenance. Closed-day snapshots are immutable:
  -- a later run must never replace a past snapshot with zero after raw deletion.
  perform pg_catalog.pg_advisory_xact_lock(84721,1);
  select greatest((installed_at at time zone 'Asia/Seoul')::date,today-29) into first_day from orbit_funnel_private.settings;
  for d in select generate_series(first_day,today-1,interval '1 day')::date loop
    insert into orbit_funnel_private.daily(day,metrics) values(d,orbit_funnel_private.compute_day(d)) on conflict do nothing;
    if found then rolled:=rolled+1; end if;
  end loop;
  delete from orbit_funnel_private.events where occurred_at<clock_timestamp()-interval '30 days';
  get diagnostics removed=row_count;
  delete from orbit_funnel_private.daily where day<today-399;
  get diagnostics removed_daily=row_count;
  return jsonb_build_object('finalized_days',rolled,'deleted_raw_events',removed,'deleted_daily_rows',removed_daily);
end; $$;
revoke all on function orbit_funnel_private.maintain() from public, anon, authenticated, service_role;
grant execute on function orbit_funnel_private.maintain() to service_role;
create or replace function public.maintain_funnel_analytics()
returns jsonb language sql security invoker set search_path='' as $$ select orbit_funnel_private.maintain() $$;
revoke all on function public.maintain_funnel_analytics() from public, anon, authenticated, service_role;
grant execute on function public.maintain_funnel_analytics() to service_role;

create or replace function orbit_funnel_private.report(p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Seoul')::date; installed timestamptz; result jsonb;
begin
  perform orbit_funnel_private.require_operator();
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>399 or p_to>today or p_from<today-399 then
    raise exception 'invalid_funnel_report_range' using errcode='22023';
  end if;
  select installed_at into installed from orbit_funnel_private.settings;
  select jsonb_agg(jsonb_build_object('day',d.day,'coverage',case
      when d.day<(installed at time zone 'Asia/Seoul')::date then 'before_installation'
      when d.day=today then 'partial_today'
      when d.day=(installed at time zone 'Asia/Seoul')::date and (a.day is not null or d.day>=today-29) then 'partial_installation_day'
      when a.day is not null then 'finalized'
      when d.day>=today-29 then 'raw_window'
      else 'unavailable' end,
    'metrics',case when d.day<(installed at time zone 'Asia/Seoul')::date then null
      when d.day=today then orbit_funnel_private.compute_day(d.day)
      when a.day is not null then a.metrics
      when d.day>=today-29 then orbit_funnel_private.compute_day(d.day) else null end) order by d.day)
    into result from (select generate_series(p_from,p_to,interval '1 day')::date as day) d
    left join orbit_funnel_private.daily a on a.day=d.day;
  return jsonb_build_object('timezone','Asia/Seoul','from',p_from,'to_inclusive',p_to,
    'server_installed_at',installed,'days',coalesce(result,'[]'::jsonb));
end; $$;
revoke all on function orbit_funnel_private.report(date,date) from public, anon, authenticated, service_role;
grant execute on function orbit_funnel_private.report(date,date) to authenticated, service_role;
create or replace function public.funnel_report(p_from date,p_to date)
returns jsonb language sql security invoker set search_path='' as $$ select orbit_funnel_private.report(p_from,p_to) $$;
revoke all on function public.funnel_report(date,date) from public, anon, authenticated, service_role;
grant execute on function public.funnel_report(date,date) to authenticated, service_role;

-- Existing Auth/DB state remains the truth for completion. No session join, new
-- member receipt, browser success assertion or UUID output is introduced.
create or replace function orbit_funnel_private.member_report(p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; today date:=(now() at time zone 'Asia/Seoul')::date;
begin
  perform orbit_funnel_private.require_operator();
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 or p_to>today then
    raise exception 'invalid_member_report_range' using errcode='22023';
  end if;
  with limits as (
    select p_from::timestamp at time zone 'Asia/Seoul' as lo,(p_to+1)::timestamp at time zone 'Asia/Seoul' as hi
  ), members as (
    select u.id,u.email_confirmed_at from auth.users u where u.is_anonymous is false and u.email_confirmed_at is not null
      and not exists(select 1 from public.admins a where a.user_id=u.id)
      and not exists(select 1 from orbit_members_private.profiles p where p.user_id=u.id and p.deleting_at is not null)
  ), cohort as (
    select m.* from members m,limits l where m.email_confirmed_at>=l.lo and m.email_confirmed_at<l.hi
  ), contributions as (
    select 'post'::text as kind,author_id,created_at from public.posts
    union all select 'comment',author_id,created_at from public.comments
    union all select 'reaction',author_id,created_at from public.reactions
  ), current_contributions as (
    select c.* from contributions c,limits l where c.created_at>=l.lo and c.created_at<l.hi
      and not exists(select 1 from public.admins a where a.user_id=c.author_id)
  ), firsts as (
    select m.id,c.kind,min(c.created_at) as first_at from members m join contributions c on c.author_id=m.id
      and c.created_at>=m.email_confirmed_at group by m.id,c.kind
  ), member_days as (
    select r.user_id,substring(r.reward_key from 7)::date as day
    from orbit_members_private.rewards r join members m on m.id=r.user_id
    where r.kind='visit' and r.reward_key ~ '^visit:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ), returning_members as (
    select user_id,min(day) as first_day,max(day) filter(where day between p_from and p_to) as latest_in_period
    from member_days group by user_id
  )
  select jsonb_build_object('timezone','Asia/Seoul','from',p_from,'to_inclusive',p_to,'includes_partial_today',p_to=today,
    'registered_admins_excluded',true,
    'verified_accounts_in_cohort',(select count(*) from cohort),
    'profiles_in_cohort',(select count(*) from cohort c join orbit_members_private.profiles p on p.user_id=c.id where p.deleting_at is null),
    'contributions',(select jsonb_object_agg(k.kind,jsonb_build_object(
      'retained_rows',(select count(*) from current_contributions c where c.kind=k.kind),
      'verified_member_rows',(select count(*) from current_contributions c join members m on m.id=c.author_id where c.kind=k.kind and c.created_at>=m.email_confirmed_at),
      'legacy_null_author_rows',(select count(*) from current_contributions c where c.kind=k.kind and c.author_id is null),
      'first_retained_members_in_period',(select count(*) from firsts f,limits l where f.kind=k.kind and f.first_at>=l.lo and f.first_at<l.hi),
      'cohort_first_retained_members',(select count(*) from firsts f join cohort c on c.id=f.id,limits l where f.kind=k.kind and f.first_at<l.hi),
      'cohort_denominator',(select count(*) from cohort))) from (values('post'),('comment'),('reaction')) k(kind)),
    'cohort_first_any_members',(select count(distinct f.id) from firsts f join cohort c on c.id=f.id,limits l where f.first_at<l.hi),
    'member_visit_days',(select count(*) from member_days where day between p_from and p_to),
    'visiting_members',(select count(*) from returning_members where latest_in_period is not null),
    'members_with_prior_date',(select count(*) from returning_members where first_day<latest_in_period),
    'legacy_daily_counter_sum',(select sum(count) from public.visits where day between p_from and p_to),
    'legacy_days_present',(select count(*) from public.visits where day between p_from and p_to)
  ) into result;
  return result;
end; $$;
revoke all on function orbit_funnel_private.member_report(date,date) from public, anon, authenticated, service_role;
grant execute on function orbit_funnel_private.member_report(date,date) to authenticated, service_role;
create or replace function public.funnel_member_report(p_from date,p_to date)
returns jsonb language sql security invoker set search_path='' as $$ select orbit_funnel_private.member_report(p_from,p_to) $$;
revoke all on function public.funnel_member_report(date,date) from public, anon, authenticated, service_role;
grant execute on function public.funnel_member_report(date,date) to authenticated, service_role;

-- Hosted production has pg_cron. WASM fixtures lack it; their dedicated test
-- installs a compatible cron.schedule stub to exercise this branch and reruns.
do $outer$
begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    create extension if not exists pg_cron;
  end if;
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('orbit-funnel-retention','45 18 * * *','select orbit_funnel_private.maintain()');
  end if;
end $outer$;
notify pgrst,'reload schema';
commit;

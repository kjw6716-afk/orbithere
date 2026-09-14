-- Only verified Resend webhooks may append delivery metadata. No message body,
-- subject, OTP, credentials, or raw SMTP response is stored here.
create schema if not exists orbit_ops_private;
revoke all on schema orbit_ops_private from public, anon, authenticated;
grant usage on schema orbit_ops_private to authenticated, service_role;

create table if not exists orbit_ops_private.delivery_events (
  event_id text not null check (length(event_id) between 1 and 200),
  email_id uuid not null,
  recipient text not null check (length(recipient) between 3 and 320),
  event_type text not null check (event_type in ('email.bounced','email.suppressed','email.failed','email.complained','email.delivery_delayed')),
  reason text not null default '' check (length(reason) <= 160),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  primary key (event_id, recipient)
);
alter table orbit_ops_private.delivery_events enable row level security;
revoke all on orbit_ops_private.delivery_events from public, anon, authenticated;
create index if not exists delivery_events_recent on orbit_ops_private.delivery_events (occurred_at desc);

-- This service-only function has no auth.uid(): Resend is machine-authenticated
-- by the Edge Function's timestamped Svix signature, then uses service_role.
create or replace function orbit_ops_private.record_delivery_event(
  p_event_id text, p_email_id uuid, p_recipient text, p_event_type text,
  p_reason text, p_occurred_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from orbit_ops_private.delivery_events where occurred_at < now() - interval '30 days';
  if p_occurred_at < now() - interval '30 days' then return; end if;
  if p_occurred_at > now() + interval '5 minutes' then raise exception 'invalid event time'; end if;
  insert into orbit_ops_private.delivery_events(event_id,email_id,recipient,event_type,reason,occurred_at)
    values(p_event_id,p_email_id,lower(p_recipient),p_event_type,p_reason,p_occurred_at)
    on conflict (event_id,recipient) do nothing;
end $$;
create or replace function public.record_delivery_event(
  p_event_id text, p_email_id uuid, p_recipient text, p_event_type text,
  p_reason text, p_occurred_at timestamptz
) returns void language sql security invoker set search_path = '' as $$
  select orbit_ops_private.record_delivery_event(p_event_id,p_email_id,p_recipient,p_event_type,p_reason,p_occurred_at);
$$;
revoke all on function orbit_ops_private.record_delivery_event(text,uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.record_delivery_event(text,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function orbit_ops_private.record_delivery_event(text,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.record_delivery_event(text,uuid,text,text,text,timestamptz) to service_role;

create or replace function orbit_ops_private.admin_delivery_alerts()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin required' using errcode = '42501'; end if;
  delete from orbit_ops_private.delivery_events where occurred_at < now() - interval '30 days';
  select jsonb_build_object(
    'unread', (select count(*) from orbit_ops_private.delivery_events where acknowledged_at is null),
    'events', coalesce((select jsonb_agg(to_jsonb(e)) from (
      select event_id,email_id,recipient,event_type,reason,occurred_at,acknowledged_at
      from orbit_ops_private.delivery_events order by (acknowledged_at is null) desc, occurred_at desc limit 100
    ) e), '[]'::jsonb)) into result;
  return result;
end $$;
create or replace function public.admin_delivery_alerts()
returns jsonb language sql security invoker set search_path = '' as $$
  select orbit_ops_private.admin_delivery_alerts();
$$;

create or replace function orbit_ops_private.acknowledge_delivery_event(p_event_id text, p_recipient text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin required' using errcode = '42501'; end if;
  update orbit_ops_private.delivery_events set acknowledged_at = coalesce(acknowledged_at,now())
    where event_id = p_event_id and recipient = p_recipient;
end $$;
create or replace function public.acknowledge_delivery_event(p_event_id text,p_recipient text)
returns void language sql security invoker set search_path = '' as $$
  select orbit_ops_private.acknowledge_delivery_event(p_event_id,p_recipient);
$$;
revoke all on function orbit_ops_private.admin_delivery_alerts(), public.admin_delivery_alerts(),
  orbit_ops_private.acknowledge_delivery_event(text,text), public.acknowledge_delivery_event(text,text) from public,anon;
grant execute on function orbit_ops_private.admin_delivery_alerts(), public.admin_delivery_alerts(),
  orbit_ops_private.acknowledge_delivery_event(text,text), public.acknowledge_delivery_event(text,text) to authenticated;

-- Hosted PostgreSQL supports pg_cron; PGlite test fixtures do not. The daily
-- purge bounds retention to 30 days plus at most one day between cleanups.
do $outer$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('orbit-delivery-retention', '35 18 * * *',
      $job$delete from orbit_ops_private.delivery_events where occurred_at < now() - interval '30 days'$job$);
  end if;
end $outer$;

begin;
set local lock_timeout='5s';
create schema if not exists orbit_members_private;
revoke all on schema orbit_members_private from public,anon,authenticated;
grant usage on schema orbit_members_private to anon,authenticated,service_role;

create table if not exists orbit_members_private.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 nickname text check(char_length(nickname) between 2 and 12 and nickname=btrim(nickname) and nickname !~ '[<>"''/\\[:cntrl:]]'),
 selected_badge text check(selected_badge in ('first-post','attendance-30','level-10')),
 policy_version text not null,
 joined_at timestamptz not null default now(),
 deleting_at timestamptz,
 check(nickname is not null or deleting_at is not null)
);
create unique index if not exists member_nickname_unique on orbit_members_private.profiles(lower(nickname));
create table if not exists orbit_members_private.events (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(btrim(title)) between 1 and 60),
 amount integer not null check(amount between 30 and 100),
 active boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create table if not exists orbit_members_private.rewards (
 user_id uuid not null references orbit_members_private.profiles(user_id) on delete cascade,
 reward_key text not null,
 kind text not null check(kind in ('visit','first-post','event')),
 amount integer not null check(amount between 1 and 100),
 event_id uuid references orbit_members_private.events(id),
 awarded_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(user_id,reward_key)
);
create index if not exists rewards_event on orbit_members_private.rewards(event_id);
create index if not exists rewards_actor on orbit_members_private.rewards(awarded_by);
create index if not exists events_actor on orbit_members_private.events(created_by);
alter table orbit_members_private.profiles enable row level security;
alter table orbit_members_private.events enable row level security;
alter table orbit_members_private.rewards enable row level security;
revoke all on all tables in schema orbit_members_private from public,anon,authenticated;

create or replace function orbit_members_private.require_member() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if not exists(select 1 from auth.users where id=actor and is_anonymous is false and email_confirmed_at is not null)
 then raise exception 'verified_member_required' using errcode='42501'; end if;
 if exists(select 1 from orbit_members_private.profiles where user_id=actor and deleting_at is not null)
 then raise exception 'withdrawal_in_progress' using errcode='42501'; end if;
 return actor;
end; $$;

create or replace function orbit_members_private.level_for(p_xp bigint) returns integer
language sql immutable security invoker set search_path='' as $$
 select floor((1+sqrt(1+0.8*greatest(p_xp,0)))/2)::integer;
$$;

create or replace function orbit_members_private.profile() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=orbit_members_private.require_member(); p orbit_members_private.profiles; xp bigint; days integer; lvl integer; badges jsonb;
begin
 select * into p from orbit_members_private.profiles where user_id=actor;
 if not found then return null; end if;
 select coalesce(sum(amount),0),count(*) filter(where kind='visit') into xp,days from orbit_members_private.rewards where user_id=actor;
 lvl:=orbit_members_private.level_for(xp);
 badges:='[]'::jsonb;
 if exists(select 1 from orbit_members_private.rewards where user_id=actor and kind='first-post') then badges:=badges||'"first-post"'::jsonb; end if;
 if days>=30 then badges:=badges||'"attendance-30"'::jsonb; end if;
 if lvl>=10 then badges:=badges||'"level-10"'::jsonb; end if;
 return jsonb_build_object('nickname',p.nickname,'xp',xp,'level',lvl,'level_start',5::bigint*(lvl-1)*lvl,'next_level',5::bigint*lvl*(lvl+1),
  'attendance_days',days,'selected_badge',p.selected_badge,'badges',badges,'joined_at',p.joined_at,
  'today_claimed',exists(select 1 from orbit_members_private.rewards where user_id=actor and reward_key='visit:'||(now() at time zone 'Asia/Seoul')::date::text),
  'history',coalesce((select jsonb_agg(x order by x.created_at desc) from (
   select r.kind,r.amount,r.created_at,e.title from orbit_members_private.rewards r left join orbit_members_private.events e on e.id=r.event_id
   where r.user_id=actor order by r.created_at desc,r.reward_key limit 30) x),'[]'::jsonb));
end; $$;

create or replace function orbit_members_private.save_profile(p_nickname text,p_policy_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=orbit_members_private.require_member();
begin
 if p_policy_version is distinct from '2026-09-14-members' then raise exception 'policy_consent_required' using errcode='22023'; end if;
 insert into orbit_members_private.profiles(user_id,nickname,policy_version) values(actor,p_nickname,p_policy_version)
 on conflict(user_id) do update set nickname=excluded.nickname,policy_version=excluded.policy_version
 where orbit_members_private.profiles.deleting_at is null;
 if not found then raise exception 'withdrawal_in_progress' using errcode='42501'; end if;
 return orbit_members_private.profile();
end; $$;

create or replace function orbit_members_private.visit() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=orbit_members_private.require_member();
begin
 perform 1 from orbit_members_private.profiles where user_id=actor and deleting_at is null for update;
 if not found then return null; end if;
 insert into orbit_members_private.rewards(user_id,reward_key,kind,amount)
 values(actor,'visit:'||(now() at time zone 'Asia/Seoul')::date::text,'visit',10) on conflict do nothing;
 if exists(select 1 from public.posts where author_id=actor) then
  insert into orbit_members_private.rewards(user_id,reward_key,kind,amount) values(actor,'first-post','first-post',20) on conflict do nothing;
 end if;
 return orbit_members_private.profile();
end; $$;

create or replace function orbit_members_private.select_badge(p_badge text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=orbit_members_private.require_member(); data jsonb:=orbit_members_private.profile();
begin
 if p_badge is not null and not ((data->'badges') ? p_badge) then raise exception 'badge_not_earned' using errcode='22023'; end if;
 update orbit_members_private.profiles set selected_badge=p_badge where user_id=actor and deleting_at is null;
 return orbit_members_private.profile();
end; $$;

-- Deliberately exposes only the public card; account email and reward receipts stay private.
create or replace function orbit_members_private.cards(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(cardinality(p_ids),0)>100 then raise exception 'too_many_members' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'nickname',p.nickname,'level',orbit_members_private.level_for(
  (select coalesce(sum(amount),0) from orbit_members_private.rewards where user_id=p.user_id)), 'badge',p.selected_badge))
 from orbit_members_private.profiles p where p.user_id=any(p_ids) and p.deleting_at is null),'[]'::jsonb);
end; $$;

create or replace function orbit_members_private.admin_events() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 return jsonb_build_object('events',coalesce((select jsonb_agg(x) from (
 select e.id,e.title,e.amount,e.active,e.created_at,(select count(*) from orbit_members_private.rewards r where r.event_id=e.id) as recipients
 from orbit_members_private.events e order by e.created_at desc limit 100) x),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(x) from (select r.created_at,r.amount,p.nickname,e.title
 from orbit_members_private.rewards r join orbit_members_private.profiles p on p.user_id=r.user_id
 join orbit_members_private.events e on e.id=r.event_id order by r.created_at desc limit 100) x),'[]'::jsonb));
end; $$;

create or replace function orbit_members_private.create_event(p_title text,p_amount integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 insert into orbit_members_private.events(title,amount,created_by) values(btrim(p_title),p_amount,auth.uid()) returning id into result;
 return result;
end; $$;

create or replace function orbit_members_private.close_event(p_event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 update orbit_members_private.events set active=false where id=p_event_id;
end; $$;

create or replace function orbit_members_private.award_event(p_event_id uuid,p_nickname text) returns boolean
language plpgsql security definer set search_path='' as $$
declare target uuid; points integer; n integer;
begin
 if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 select amount into points from orbit_members_private.events where id=p_event_id and active for share;
 if not found then raise exception 'event_closed_or_missing' using errcode='22023'; end if;
 select user_id into target from orbit_members_private.profiles where lower(nickname)=lower(btrim(p_nickname)) and deleting_at is null for update;
 if not found then raise exception 'member_not_found' using errcode='22023'; end if;
 insert into orbit_members_private.rewards(user_id,reward_key,kind,amount,event_id,awarded_by)
 values(target,'event:'||p_event_id::text,'event',points,p_event_id,auth.uid()) on conflict do nothing;
 get diagnostics n=row_count;
 return n=1;
end; $$;

-- Freeze community writes while physical photos and the account are removed.
create or replace function orbit_members_private.guard_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare p orbit_members_private.profiles;
begin
 select * into p from orbit_members_private.profiles where user_id=auth.uid() for share;
 if found and p.deleting_at is not null then raise exception 'withdrawal_in_progress' using errcode='42501'; end if;
 if tg_table_name in ('posts','comments') and tg_op='INSERT' and p.user_id is not null then new.nick:=p.nickname; end if;
 return new;
end; $$;
do $$ declare t text; begin
 foreach t in array array['posts','comments','reactions','reports'] loop
  execute format('drop trigger if exists c_member_write on public.%I',t);
  execute format('create trigger c_member_write before insert or update on public.%I for each row execute function orbit_members_private.guard_write()',t);
 end loop;
end; $$;
drop trigger if exists c_member_storage_write on storage.objects;
create trigger c_member_storage_write before insert or update on storage.objects for each row execute function orbit_members_private.guard_write();

-- Only the Edge Function's service role may initiate/finalize withdrawal after password reauthentication.
create or replace function orbit_members_private.begin_withdrawal(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.admins where user_id=p_user_id) then raise exception 'admin_transfer_required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=p_user_id and is_anonymous is false and email_confirmed_at is not null)
 then raise exception 'verified_member_required' using errcode='42501'; end if;
 -- A member can withdraw even if profile setup was never completed.
 insert into orbit_members_private.profiles(user_id,nickname,policy_version,deleting_at)
 values(p_user_id,null,'withdrawal',now())
 on conflict(user_id) do update set deleting_at=coalesce(orbit_members_private.profiles.deleting_at,now());
end; $$;
create or replace function orbit_members_private.withdrawal_files(p_user_id uuid) returns text[]
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from orbit_members_private.profiles where user_id=p_user_id and deleting_at is not null) then raise exception 'withdrawal_not_started'; end if;
 return coalesce((select array_agg(name) from (select name from storage.objects where bucket_id='board-images' and split_part(name,'/',1)=p_user_id::text order by name limit 100) x),'{}'::text[]);
end; $$;
create or replace function orbit_members_private.finish_withdrawal(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from orbit_members_private.profiles where user_id=p_user_id and deleting_at is not null for update;
 if not found or exists(select 1 from public.admins where user_id=p_user_id) then raise exception 'withdrawal_not_started'; end if;
 if exists(select 1 from storage.objects where bucket_id='board-images' and split_part(name,'/',1)=p_user_id::text) then raise exception 'photos_remain'; end if;
 delete from public.reports where author_id=p_user_id;
 delete from public.reactions where author_id=p_user_id;
 delete from public.comments where author_id=p_user_id;
 delete from public.posts where author_id=p_user_id;
 -- Auth Admin API deletes auth.users afterwards; FK cascades remove private data.
end; $$;

-- Public invoker RPCs route to individually granted, guarded private functions.
do $$
declare x record;
begin
 for x in select * from (values
 ('member_profile','','jsonb','profile()','authenticated'),
 ('member_save_profile','p_nickname text,p_policy_version text','jsonb','save_profile(p_nickname,p_policy_version)','authenticated'),
 ('member_visit','','jsonb','visit()','authenticated'),
 ('member_select_badge','p_badge text','jsonb','select_badge(p_badge)','authenticated'),
 ('member_cards','p_ids uuid[]','jsonb','cards(p_ids)','anon,authenticated'),
 ('member_admin_events','','jsonb','admin_events()','authenticated'),
 ('member_create_event','p_title text,p_amount integer','uuid','create_event(p_title,p_amount)','authenticated'),
 ('member_close_event','p_event_id uuid','void','close_event(p_event_id)','authenticated'),
 ('member_award_event','p_event_id uuid,p_nickname text','boolean','award_event(p_event_id,p_nickname)','authenticated'),
 ('member_begin_withdrawal','p_user_id uuid','void','begin_withdrawal(p_user_id)','service_role'),
 ('member_withdrawal_files','p_user_id uuid','text[]','withdrawal_files(p_user_id)','service_role'),
 ('member_finish_withdrawal','p_user_id uuid','void','finish_withdrawal(p_user_id)','service_role')
 ) v(name,args,result,call,roles) loop
  execute format('create or replace function public.%I(%s) returns %s language sql security invoker set search_path='''' as %L',x.name,x.args,x.result,'select orbit_members_private.'||x.call);
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',x.name,x.args);
  execute format('grant execute on function public.%I(%s) to %s',x.name,x.args,x.roles);
  execute format('revoke all on function orbit_members_private.%s(%s) from public,anon,authenticated,service_role',split_part(x.call,'(',1),x.args);
  execute format('grant execute on function orbit_members_private.%s(%s) to %s',split_part(x.call,'(',1),x.args,x.roles);
 end loop;
end; $$;
revoke all on function orbit_members_private.require_member(),orbit_members_private.level_for(bigint),orbit_members_private.guard_write() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;

begin;
set local lock_timeout='5s';

alter table orbit_members_private.profiles add column if not exists nickname_changed_at timestamptz;
-- Existing members start their first 30-day period at profile creation.
update orbit_members_private.profiles set nickname_changed_at=joined_at where nickname_changed_at is null;
alter table orbit_members_private.profiles alter column nickname_changed_at set default now();
alter table orbit_members_private.profiles alter column nickname_changed_at set not null;

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
  'nickname_change_available_at',p.nickname_changed_at + interval '720 hours',
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
 -- ON CONFLICT locks the profile row, so simultaneous requests cannot bypass the cooldown.
 insert into orbit_members_private.profiles(user_id,nickname,policy_version)
 values(actor,p_nickname,p_policy_version)
 on conflict(user_id) do update set nickname=excluded.nickname,policy_version=excluded.policy_version,
  nickname_changed_at=case when orbit_members_private.profiles.nickname is distinct from excluded.nickname
    then now() else orbit_members_private.profiles.nickname_changed_at end
 where orbit_members_private.profiles.deleting_at is null
  and (orbit_members_private.profiles.nickname is not distinct from excluded.nickname
       or orbit_members_private.profiles.nickname_changed_at + interval '720 hours' <= now());
 if not found then
  if exists(select 1 from orbit_members_private.profiles where user_id=actor and deleting_at is not null)
   then raise exception 'withdrawal_in_progress' using errcode='42501'; end if;
  raise exception 'nickname_cooldown' using errcode='P0001';
 end if;
 return orbit_members_private.profile();
end; $$;

commit;

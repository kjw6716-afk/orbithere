-- Display roles come only from the protected administrator registry.
-- This adds no role grants and leaves membership, XP, and nickname rules intact.
begin;
set local lock_timeout='5s';

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
  'is_admin',exists(select 1 from public.admins where user_id=actor),
  'nickname_change_available_at',p.nickname_changed_at + interval '720 hours',
  'today_claimed',exists(select 1 from orbit_members_private.rewards where user_id=actor and reward_key='visit:'||(now() at time zone 'Asia/Seoul')::date::text),
  'history',coalesce((select jsonb_agg(x order by x.created_at desc) from (
   select r.kind,r.amount,r.created_at,e.title from orbit_members_private.rewards r left join orbit_members_private.events e on e.id=r.event_id
   where r.user_id=actor order by r.created_at desc,r.reward_key limit 30) x),'[]'::jsonb));
end; $$;

-- Only the existing public card fields and an explicit display flag are returned.
-- Registry notes, timestamps, and account information stay private.
create or replace function orbit_members_private.cards(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(cardinality(p_ids),0)>100 then raise exception 'too_many_members' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'nickname',p.nickname,'level',orbit_members_private.level_for(
  (select coalesce(sum(amount),0) from orbit_members_private.rewards where user_id=p.user_id)), 'badge',p.selected_badge,
  'is_admin',exists(select 1 from public.admins where user_id=p.user_id)))
 from orbit_members_private.profiles p where p.user_id=any(p_ids) and p.deleting_at is null),'[]'::jsonb);
end; $$;

-- CREATE OR REPLACE preserves the existing RPC and private-function ACLs.
notify pgrst,'reload schema';
commit;

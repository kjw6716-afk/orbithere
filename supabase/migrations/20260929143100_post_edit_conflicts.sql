-- Compare the version loaded by the editor under the same lock as the update.
begin;
set local lock_timeout='5s';

create or replace function orbit_post_edit_private.edit_post(
 p_id uuid,p_title text,p_text text,p_orbit text,p_observation jsonb,p_expected_edited_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=orbit_members_private.require_writer(); previous public.posts;
begin
 select * into previous from public.posts where id=p_id and author_id=actor for update;
 if not found then raise exception 'orbit_post_edit_forbidden' using errcode='42501'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 1 and 80
 then raise exception 'orbit_title_required' using errcode='23514'; end if;
 if p_text is null or char_length(btrim(p_text)) not between 1 and 5000
 then raise exception 'orbit_text_required' using errcode='23514'; end if;
 if not orbit_observation_private.valid_board_observation(p_observation)
 then raise exception 'orbit_observation_invalid' using errcode='23514'; end if;
 -- A committed save whose response was lost can be retried without changing its
 -- timestamp. This is safe only when every editable field already matches.
 if (previous.title,previous.text,previous.orbit,previous.observation)
    is not distinct from (btrim(p_title),btrim(p_text),p_orbit,p_observation) then
  return p_id;
 end if;
 if previous.edited_at is distinct from p_expected_edited_at then
  raise exception 'orbit_post_edit_conflict' using errcode='P0001';
 end if;
 update public.posts set title=btrim(p_title),text=btrim(p_text),orbit=p_orbit,
  observation=p_observation,edited_at=clock_timestamp()
 where id=p_id and author_id=actor;
 return p_id;
end; $$;
revoke all on function orbit_post_edit_private.edit_post(uuid,text,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function orbit_post_edit_private.edit_post(uuid,text,text,text,jsonb,timestamptz) to authenticated;

create or replace function public.board_edit_post(
 p_id uuid,p_title text,p_text text,p_orbit text,p_observation jsonb,p_expected_edited_at timestamptz
) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 return orbit_post_edit_private.edit_post(p_id,p_title,p_text,p_orbit,p_observation,p_expected_edited_at);
end; $$;
revoke all on function public.board_edit_post(uuid,text,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.board_edit_post(uuid,text,text,text,jsonb,timestamptz) to authenticated;

-- Cached clients cannot safely supply a baseline. Keep their signatures for a
-- clear upgrade error, but never allow the former path to overwrite newer text.
create or replace function orbit_post_edit_private.edit_post(
 p_id uuid,p_title text,p_text text,p_orbit text,p_observation jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
begin
 raise exception 'orbit_post_edit_version_required' using errcode='P0001';
end; $$;
create or replace function public.board_edit_post(
 p_id uuid,p_title text,p_text text,p_orbit text,p_observation jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'orbit_post_edit_version_required' using errcode='P0001';
end; $$;
revoke all on function orbit_post_edit_private.edit_post(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function orbit_post_edit_private.edit_post(uuid,text,text,text,jsonb) to authenticated;
revoke all on function public.board_edit_post(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.board_edit_post(uuid,text,text,text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;

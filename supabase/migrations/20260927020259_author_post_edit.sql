-- Author-only editing, without widening posts UPDATE grants or pin RLS.
begin;
set local lock_timeout='5s';
alter table public.posts add column if not exists edited_at timestamptz;
grant select(edited_at) on public.posts to anon,authenticated;

create schema if not exists orbit_post_edit_private;
revoke all on schema orbit_post_edit_private from public,anon,authenticated;
grant usage on schema orbit_post_edit_private to authenticated;

-- The narrowly scoped definer lives outside the exposed API schema, as with
-- reaction/member helpers. It validates the real Auth user and row owner even
-- when called directly; administrator status never substitutes for ownership.
create or replace function orbit_post_edit_private.edit_post(
 p_id uuid,p_title text,p_text text,p_orbit text,p_observation jsonb
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
 -- Reuse the existing orbit/observation CHECK constraints. Unchanged retries
 -- preserve the original edited_at and do not look like additional edits.
 if (previous.title,previous.text,previous.orbit,previous.observation)
    is distinct from (btrim(p_title),btrim(p_text),p_orbit,p_observation) then
  update public.posts set title=btrim(p_title),text=btrim(p_text),orbit=p_orbit,
   observation=p_observation,edited_at=clock_timestamp()
  where id=p_id and author_id=actor;
 end if;
 return p_id;
end; $$;
revoke all on function orbit_post_edit_private.edit_post(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function orbit_post_edit_private.edit_post(uuid,text,text,text,jsonb) to authenticated;

create or replace function public.board_edit_post(
 p_id uuid,p_title text,p_text text,p_orbit text,p_observation jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 return orbit_post_edit_private.edit_post(p_id,p_title,p_text,p_orbit,p_observation);
end; $$;
revoke all on function public.board_edit_post(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.board_edit_post(uuid,text,text,text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;

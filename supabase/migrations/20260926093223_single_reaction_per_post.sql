-- One selected emoji per authenticated identity/post, including anonymous Auth.
-- Run before deploying the client RPC change. Existing public counts stay readable.
begin;
set local lock_timeout='5s';

create schema if not exists orbit_reaction_private;
revoke all on schema orbit_reaction_private from public,anon,authenticated;
grant usage on schema orbit_reaction_private to authenticated;

-- Stop writes between choosing the surviving row and creating its unique index.
lock table public.reactions in share row exclusive mode;
do $$
begin
 if exists(select 1 from public.reactions where author_id is not null group by post_id,author_id having count(*)>1) then
  create table if not exists orbit_reaction_private.migration_backup (
   id bigint primary key,
   post_id uuid not null references public.posts(id) on delete cascade,
   author_id uuid not null references auth.users(id) on delete cascade,
   emoji text not null,
   device_id text not null,
   created_at timestamptz not null,
   retained_reaction_id bigint not null,
   archived_at timestamptz not null default now()
  );
  alter table orbit_reaction_private.migration_backup enable row level security;
  revoke all on orbit_reaction_private.migration_backup from public,anon,authenticated;
  with ranked as (
   select r.*,row_number() over(partition by post_id,author_id order by created_at desc,id desc) as position,
    first_value(id) over(partition by post_id,author_id order by created_at desc,id desc) as retained_id
   from public.reactions r where author_id is not null
  )
  insert into orbit_reaction_private.migration_backup(id,post_id,author_id,emoji,device_id,created_at,retained_reaction_id)
  select id,post_id,author_id,emoji,device_id,created_at,retained_id from ranked where position>1
  on conflict(id) do nothing;
  delete from public.reactions r using orbit_reaction_private.migration_backup b
  where r.id=b.id and r.post_id=b.post_id and r.author_id=b.author_id
   and r.emoji=b.emoji and r.device_id=b.device_id and r.created_at=b.created_at;
 end if;
end; $$;
-- Ordinary unique indexes allow NULL owners to coexist. Do not claim or alter legacy rows.
create unique index if not exists reactions_one_per_author on public.reactions(post_id,author_id);

create or replace function orbit_reaction_private.set_reaction(p_post_id uuid,p_emoji text,p_selected boolean)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); selected_emoji text;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_post_id is null or p_selected is null or p_emoji is null or p_emoji not in ('⭐','🔥','😂','🥰','👏','❤️')
 then raise exception 'Invalid reaction' using errcode='22023'; end if;
 -- Parent first, then author/post lock: deletion cannot orphan reactions, and
 -- setting/clearing one identity on several devices is serialized consistently.
 perform 1 from public.posts where id=p_post_id for key share;
 if not found then raise exception 'Post not found' using errcode='P0002'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':reaction:'||p_post_id::text,0));
 if p_selected then
  insert into public.reactions(post_id,emoji,device_id,author_id)
  values(p_post_id,p_emoji,actor::text,actor)
  on conflict(post_id,author_id) do update set emoji=excluded.emoji,created_at=excluded.created_at
  where public.reactions.emoji is distinct from excluded.emoji;
 else
  -- A delayed cancellation of an old choice must not erase a newer emoji.
  delete from public.reactions where post_id=p_post_id and author_id=actor and emoji=p_emoji;
 end if;
 select emoji into selected_emoji from public.reactions where post_id=p_post_id and author_id=actor;
 -- Recovery copies are private, expire after 30 days, and cascade with their
 -- account/post. Expired rows are removed on the next successful reaction call.
 if pg_catalog.to_regclass('orbit_reaction_private.migration_backup') is not null then
  delete from orbit_reaction_private.migration_backup where archived_at<now()-interval '30 days';
 end if;
 return selected_emoji;
end; $$;
revoke all on function orbit_reaction_private.set_reaction(uuid,text,boolean) from public,anon,authenticated;
grant execute on function orbit_reaction_private.set_reaction(uuid,text,boolean) to authenticated;

create or replace function public.set_reaction(p_post_id uuid,p_emoji text,p_selected boolean)
returns text language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.posts where id=p_post_id) then raise exception 'Post not found' using errcode='P0002'; end if;
 return orbit_reaction_private.set_reaction(p_post_id,p_emoji,p_selected);
end; $$;
revoke all on function public.set_reaction(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.set_reaction(uuid,text,boolean) to authenticated;

-- Cached clients can still make their first INSERT or cancel. A second emoji
-- INSERT hits the new unique index; it cannot create a second reaction. The
-- current client uses set_reaction to replace in one operation.
create or replace function public.delete_reaction(p_post_id uuid,p_emoji text,p_device text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform public.set_reaction(p_post_id,p_emoji,false);
end; $$;
revoke all on function public.delete_reaction(uuid,text,text) from public,anon,authenticated;
grant execute on function public.delete_reaction(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
commit;

-- Apply after 010 in the existing project. No content is deleted.
-- Also enable Authentication > Providers > Anonymous Sign-Ins in Supabase.
-- Legacy device IDs were public: they cannot prove ownership and must NEVER
-- be used to backfill author_id. Existing content remains readable; only an
-- administrator may delete legacy content whose author_id is NULL.
begin;

alter table public.posts add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.comments add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.reactions add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.reports add column if not exists author_id uuid references auth.users(id) on delete set null;
create index if not exists posts_author_id on public.posts(author_id);
create index if not exists comments_author_id on public.comments(author_id);
create index if not exists reactions_author_id on public.reactions(author_id);
create index if not exists reports_author_id on public.reports(author_id);

-- Run before the existing rate-limit triggers. A forged device ID or timestamp
-- must not evade the per-author limits, nor may a caller pre-handle a report.
create or replace function public.bind_community_author()
returns trigger language plpgsql set search_path = public as $$
declare actor uuid := auth.uid();
begin
  if actor is null or (new.author_id is not null and new.author_id <> actor) then
    raise exception 'Authenticated author required' using errcode = '42501';
  end if;
  new.author_id := actor;
  new.created_at := statement_timestamp();
  if tg_table_name in ('posts', 'comments') then new.author_device := actor::text;
  elsif tg_table_name = 'reactions' then new.device_id := actor::text;
  elsif tg_table_name = 'reports' then new.reporter_device := actor::text; new.handled := false;
  end if;
  return new;
end;
$$;
revoke all on function public.bind_community_author() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['posts','comments','reactions','reports'] loop
    execute format('drop trigger if exists a_bind_community_author on public.%I', t);
    execute format('create trigger a_bind_community_author before insert on public.%I for each row execute function public.bind_community_author()', t);
  end loop;
end;
$$;

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists rx_insert on public.reactions;
create policy rx_insert on public.reactions for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated with check (author_id = (select auth.uid()) and handled = false);

drop policy if exists posts_owner_delete on public.posts;
create policy posts_owner_delete on public.posts for delete to authenticated using (author_id = (select auth.uid()));
drop policy if exists comments_owner_delete on public.comments;
create policy comments_owner_delete on public.comments for delete to authenticated using (author_id = (select auth.uid()));
-- Existing administrator delete policies from 005 remain in force.

-- Column grants protect the old device identifiers even from a direct REST
-- request. A UI-only select list would not secure the database.
revoke select on public.posts, public.comments from anon, authenticated;
grant select(id,nick,orbit,text,created_at,author_id) on public.posts to anon, authenticated;
grant select(id,post_id,nick,text,created_at,author_id) on public.comments to anon, authenticated;
revoke insert on public.posts, public.comments, public.reactions, public.reports from anon;
grant insert on public.posts, public.comments, public.reactions, public.reports to authenticated;
grant delete on public.posts, public.comments to authenticated;
revoke update on public.posts, public.comments, public.reactions from anon, authenticated;
revoke delete on public.posts, public.comments, public.reactions from anon;

-- Harden the old RPC signatures too; revoking only the UI path is not enough.
-- p_device remains for cached clients but never grants any authority.
create or replace function public.delete_post(p_id uuid, p_device text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  delete from public.posts where id=p_id and (author_id=auth.uid() or public.is_admin());
end;
$$;
create or replace function public.delete_comment(p_id uuid, p_device text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  delete from public.comments where id=p_id and (author_id=auth.uid() or public.is_admin());
end;
$$;
create or replace function public.delete_reaction(p_post_id uuid, p_emoji text, p_device text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  delete from public.reactions where post_id=p_post_id and emoji=p_emoji and author_id=auth.uid();
end;
$$;
revoke all on function public.delete_post(uuid,text), public.delete_comment(uuid,text), public.delete_reaction(uuid,text,text) from public, anon;
grant execute on function public.delete_post(uuid,text), public.delete_comment(uuid,text), public.delete_reaction(uuid,text,text) to authenticated;

create or replace function public.reaction_summary(p_post_ids uuid[], p_device text)
returns table(post_id uuid, emoji text, n bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.post_id, r.emoji, count(*), coalesce(bool_or(r.author_id=auth.uid()),false)
  from public.reactions r where r.post_id=any(p_post_ids) group by r.post_id,r.emoji;
$$;
revoke all on function public.reaction_summary(uuid[],text) from public;
grant execute on function public.reaction_summary(uuid[],text) to anon, authenticated;

create or replace function public.community_version()
returns integer language sql immutable set search_path = public as $$ select 2; $$;
revoke all on function public.community_version() from public;
grant execute on function public.community_version() to anon, authenticated;
notify pgrst, 'reload schema';
commit;

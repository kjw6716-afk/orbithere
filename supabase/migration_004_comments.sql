-- ============================================
-- 댓글 — 궤적에 달리는 답
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- posts와 같은 원칙을 그대로 따른다:
--   · 읽기·쓰기는 누구나 (입력 제한은 check 제약이 담당)
--   · 삭제는 작성한 기기에서만 — delete 정책을 두지 않고 RPC로만 연다
--   · 도배 방지는 insert 트리거
--
-- 글보다 댓글이 자연스럽게 더 자주 달리므로 속도 제한은 조금 느슨하게 잡았다.
-- 글자 수도 500자가 아니라 300자 — 길어지면 그건 댓글이 아니라 새 궤적이다.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  nick text not null check (char_length(nick) between 2 and 12),
  text text not null check (char_length(text) between 1 and 300),
  author_device text not null check (char_length(author_device) between 8 and 64),
  created_at timestamptz not null default now()
);

-- 글 하나의 댓글을 시간순으로 읽는 조회에 맞춘 인덱스
create index if not exists comments_post_created
  on public.comments (post_id, created_at);

-- 도배 방지 트리거가 매 insert마다 세는 구간 조회용
create index if not exists comments_device_created
  on public.comments (author_device, created_at desc);

alter table public.comments enable row level security;

drop policy if exists "comments_read" on public.comments;
create policy "comments_read" on public.comments for select using (true);

drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments for insert with check (true);

-- delete 정책을 일부러 만들지 않는다 → REST로는 남의 댓글을 지울 수 없다.
-- 작성 기기가 일치할 때만 지우는 아래 함수를 통해서만 삭제된다.
create or replace function public.delete_comment(p_id uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.comments where id = p_id and author_device = p_device;
end;
$$;

grant execute on function public.delete_comment(uuid, text) to anon;

-- ===== 도배 방지 =====
-- posts와 마찬가지로 익명 구조라 완벽하지 않다 — 기기 ID(localStorage)를 지우면
-- 새 기기가 되므로 작정한 공격자는 우회할 수 있다. 실수 연타와 단순 스크립트
-- 도배를 막는 것이 목적이다.
--
-- 클라이언트(lounge.html의 errHint)가 'orbit_comment_rate_limit' 문구를 보고
-- 안내를 띄우므로, 예외 이름을 바꾸면 그쪽도 같이 바꿀 것.
create or replace function public.comments_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  -- 같은 기기에서 1분에 5개까지
  select count(*) into recent
    from public.comments
   where author_device = new.author_device
     and created_at > now() - interval '1 minute';
  if recent >= 5 then
    raise exception 'orbit_comment_rate_limit';
  end if;

  -- 같은 기기에서 1시간에 50개까지
  select count(*) into recent
    from public.comments
   where author_device = new.author_device
     and created_at > now() - interval '1 hour';
  if recent >= 50 then
    raise exception 'orbit_comment_rate_limit';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.comments_rate_limit();

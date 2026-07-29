-- ============================================
-- 관리자(마스터) 계정 — 모든 궤적·답 삭제 권한
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- 【먼저 할 일】
--   1) Authentication → Users → Add user 로 관리자 계정을 하나 만든다.
--      이때 'Auto Confirm User'를 켠다. 안 켜면 인증 메일을 받을 수 없어
--      로그인이 'Email not confirmed'로 막힌다.
--   2) 그 계정의 User UID를 복사해 아래 ADMIN_UID 자리에 붙여넣는다.
--   3) 이 파일 전체를 Run 한다.
--
-- 【설계 원칙】
--   권한의 근거는 "로그인했다"가 아니라 "admins 테이블에 있다"이다.
--   그래서 혹시 누가 가입에 성공하더라도 아무 권한 없는 일반 계정일 뿐이다.
--   (가입 차단은 위생 조치이고, 보안의 경계선은 이 테이블이다)
--
--   판정은 전부 서버(RLS)에서 한다. 클라이언트가 보내는 값으로 권한을
--   정하지 않으므로, 브라우저 쪽 코드를 조작해도 남의 글을 지울 수 없다.

-- ===== 관리자 명단 =====
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

-- RLS를 켜되 정책은 하나도 두지 않는다 →
-- 이 테이블은 REST로 아무도 읽거나 쓸 수 없다.
-- 아래 is_admin()만 security definer로 우회해서 읽는다.
-- (관리자 명단이 공개되면 누구를 노려야 하는지 알려주는 셈이 된다)
alter table public.admins enable row level security;

-- ===== 관리자 여부 =====
-- security definer라 admins의 RLS를 통과해 읽을 수 있다.
-- auth.uid()는 요청에 실린 JWT에서 서버가 직접 꺼내므로 위조할 수 없다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ===== 삭제 권한 =====
-- 기존 구조는 그대로 둔다: 일반 사용자는 delete 정책이 없어 REST로는 못 지우고,
-- 작성 기기가 일치할 때만 delete_post / delete_comment RPC로 지운다.
-- 여기에 관리자용 정책을 더해, 로그인한 관리자만 REST delete가 통과되게 한다.

drop policy if exists "posts_admin_delete" on public.posts;
create policy "posts_admin_delete" on public.posts
  for delete to authenticated using (public.is_admin());

drop policy if exists "comments_admin_delete" on public.comments;
create policy "comments_admin_delete" on public.comments
  for delete to authenticated using (public.is_admin());

-- ===== 리액션 삭제 구멍 막기 =====
-- 기존 정책은 rx_delete가 using (true)라, REST로 아무나 남의 리액션을
-- 지울 수 있었다. 리액션 취소는 아래 RPC로만 가능하게 좁히고,
-- 정책은 관리자에게만 남긴다.
drop policy if exists "rx_delete" on public.reactions;
create policy "rx_admin_delete" on public.reactions
  for delete to authenticated using (public.is_admin());

-- 내 리액션 취소 — 기기가 일치할 때만 지운다
create or replace function public.delete_reaction(p_post_id uuid, p_emoji text, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.reactions
   where post_id = p_post_id and emoji = p_emoji and device_id = p_device;
end;
$$;

grant execute on function public.delete_reaction(uuid, text, text) to anon, authenticated;

-- ===== 리액션 집계 =====
-- 지금까지는 클라이언트가 reactions 행을 통째로 받아 device_id까지 봤다.
-- 그러면 남의 기기 ID가 전부 노출돼서, 위 RPC가 있어도 그 값을 그대로 넣어
-- 남의 리액션을 지울 수 있다. 개수와 "내가 눌렀는지"만 돌려주고
-- device_id 자체는 밖으로 내보내지 않는다.
create or replace function public.reaction_summary(p_post_ids uuid[], p_device text)
returns table (post_id uuid, emoji text, n bigint, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.post_id,
         r.emoji,
         count(*) as n,
         bool_or(r.device_id = p_device) as mine
    from public.reactions r
   where r.post_id = any(p_post_ids)
   group by r.post_id, r.emoji;
$$;

grant execute on function public.reaction_summary(uuid[], text) to anon, authenticated;

-- reactions를 직접 select 하는 경로도 device_id를 흘리므로 닫는다.
-- 읽기는 위 reaction_summary로만 한다.
-- (main.html의 Trending은 post_id만 세므로 아래 집계 함수로 옮긴다)
drop policy if exists "rx_read" on public.reactions;

create or replace function public.reaction_counts(p_limit int default 1000)
returns table (post_id uuid, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.post_id, count(*) as n
    from public.reactions r
   group by r.post_id
   order by n desc
   limit p_limit;
$$;

grant execute on function public.reaction_counts(int) to anon, authenticated;

-- ===== 관리자 등록 =====
-- 아래 'ADMIN_UID_HERE'를 Authentication → Users에서 복사한 User UID로 바꾼다.
-- 예: insert into public.admins (user_id, note) values ('a1b2c3d4-...', '운영자');
--
-- UID를 아직 모르면 이 줄만 빼고 나머지를 먼저 Run 해도 된다.
-- 나중에 이 한 줄만 다시 실행하면 관리자로 등록된다.

-- insert into public.admins (user_id, note)
-- values ('ADMIN_UID_HERE', '운영자')
-- on conflict (user_id) do nothing;

-- ===== 등록 확인 =====
-- 아래를 실행해 관리자 계정이 제대로 들어갔는지 볼 수 있다.
-- select u.email, a.note, a.created_at
--   from public.admins a join auth.users u on u.id = a.user_id;

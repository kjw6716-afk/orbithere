-- ============================================
-- 신고 — 이용자가 문제 있는 궤적·답을 알리는 경로
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- 관리자 삭제(migration_005)만으로는 부족하다. 운영자가 24시간 광장을
-- 보고 있을 수 없으므로, 문제를 먼저 보는 사람은 언제나 이용자다.
-- 지금은 그 사람이 알릴 방법이 아예 없다.
--
-- 【설계】
--   · 신고는 누구나 남길 수 있다 (로그인 없는 구조 유지)
--   · 신고 내역은 관리자만 읽는다 — 누가 누구를 신고했는지가 공개되면
--     보복이 생기고, 신고 자체를 안 하게 된다
--   · 같은 기기가 같은 대상을 여러 번 신고해도 한 건으로 친다
--   · 도배 방지는 글·댓글과 같은 트리거 방식

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'abuse', 'adult', 'privacy', 'etc')),
  detail text check (detail is null or char_length(detail) <= 200),
  reporter_device text not null check (char_length(reporter_device) between 8 and 64),
  handled boolean not null default false,
  created_at timestamptz not null default now(),
  -- 한 기기가 같은 대상을 반복 신고해 목록을 채우지 못하게 한다.
  -- 클라이언트는 여기서 나는 23505를 "이미 신고함"으로 안내한다.
  unique (target_type, target_id, reporter_device)
);

-- 관제실 목록은 미처리 → 최신 순으로 본다
create index if not exists reports_queue on public.reports (handled, created_at desc);
-- 도배 방지 트리거가 세는 구간
create index if not exists reports_device_created on public.reports (reporter_device, created_at desc);

alter table public.reports enable row level security;

-- 신고 접수는 누구나. 입력 제한은 위의 check가 담당한다.
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports for insert with check (true);

-- 읽기·수정은 관리자만. select 정책을 열어두면 신고자 기기 ID와
-- "무엇이 신고당했는지"가 그대로 노출된다.
drop policy if exists "reports_admin_read" on public.reports;
create policy "reports_admin_read" on public.reports
  for select to authenticated using (public.is_admin());

drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_admin_update" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== 도배 방지 =====
-- 클라이언트(lounge.html의 errHint)가 'orbit_report_rate_limit'를 보고
-- 안내를 띄우므로 예외 이름을 바꾸면 그쪽도 같이 바꿀 것.
create or replace function public.reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  select count(*) into recent
    from public.reports
   where reporter_device = new.reporter_device
     and created_at > now() - interval '1 minute';
  if recent >= 5 then
    raise exception 'orbit_report_rate_limit';
  end if;

  select count(*) into recent
    from public.reports
   where reporter_device = new.reporter_device
     and created_at > now() - interval '1 hour';
  if recent >= 30 then
    raise exception 'orbit_report_rate_limit';
  end if;

  return new;
end;
$$;

drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit
  before insert on public.reports
  for each row execute function public.reports_rate_limit();

-- ===== 관제실 목록 =====
-- 신고만 봐서는 조치할 수 없다. 신고당한 내용이 함께 보여야 한다.
-- security definer라 RLS를 지나치므로 함수 안에서 관리자 여부를 직접 막는다.
--
-- target_exists가 false면 이미 지워진 대상이다 — 목록에는 남겨서
-- "처리됨"을 누를 수 있게 한다.
create or replace function public.report_queue()
returns table (
  id uuid, target_type text, target_id uuid, reason text, detail text,
  created_at timestamptz, handled boolean,
  nick text, content text, orbit text, target_exists boolean, dup_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.target_type, r.target_id, r.reason, r.detail,
         r.created_at, r.handled,
         coalesce(p.nick, c.nick) as nick,
         coalesce(p.text, c.text) as content,
         p.orbit,
         (p.id is not null or c.id is not null) as target_exists,
         (select count(*) from public.reports r2
           where r2.target_type = r.target_type and r2.target_id = r.target_id) as dup_count
    from public.reports r
    left join public.posts    p on r.target_type = 'post'    and p.id = r.target_id
    left join public.comments c on r.target_type = 'comment' and c.id = r.target_id
   where public.is_admin()
   order by r.handled asc, r.created_at desc
   limit 200;
$$;

grant execute on function public.report_queue() to authenticated;

-- ===== 처리 =====
-- 대상을 지울지 여부를 받아서, 같은 대상에 달린 신고를 한꺼번에 처리됨으로 바꾼다.
-- (한 글에 신고가 여러 건이면 하나씩 닫는 건 의미가 없다)
create or replace function public.resolve_report(p_report_id uuid, p_delete_target boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reports;
begin
  if not public.is_admin() then
    raise exception 'orbit_not_admin';
  end if;

  select * into r from public.reports where id = p_report_id;
  if not found then return; end if;

  if p_delete_target then
    if r.target_type = 'post' then
      delete from public.posts where id = r.target_id;   -- 댓글·리액션은 cascade
    else
      delete from public.comments where id = r.target_id;
    end if;
  end if;

  update public.reports
     set handled = true
   where target_type = r.target_type and target_id = r.target_id;
end;
$$;

grant execute on function public.resolve_report(uuid, boolean) to authenticated;

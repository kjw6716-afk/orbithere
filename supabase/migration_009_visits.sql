-- ============================================
-- 방문 집계 (visits.js의 위젯이 쓴다)
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- Search Console이 "검색에서 몇 명이 눌렀나"를 알려준다면,
-- 이 테이블은 "실제로 사이트에 몇 명이 들어왔나"를 하루 단위로 센다.
-- 개인을 식별하지 않는다 — 날짜별 숫자 하나가 전부다.
-- (같은 기기 하루 한 번 제한은 클라이언트 localStorage가 맡는 느슨한
--  집계라서 정확한 통계가 아니라 추세를 보는 용도다. 정확한 수치는
--  Search Console 쪽을 기준으로 삼을 것.)
--
-- 날짜 기준은 한국 시간(Asia/Seoul)이다. Supabase 서버는 UTC라서
-- current_date를 그대로 쓰면 오전 9시 전까지 어제로 집계된다.

create table if not exists public.visits (
  day date primary key,
  count bigint not null default 0
);

alter table public.visits enable row level security;
-- 정책을 만들지 않는다 — 테이블 직접 읽기/쓰기는 모두 막고,
-- 아래 security definer 함수로만 드나들게 한다.
-- (직접 쓰기를 열어두면 숫자를 마음대로 덮어쓸 수 있다)

create or replace function public.record_visit(p_count boolean default true)
returns table (today bigint, total bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  kst_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_count then
    insert into public.visits as v (day, count) values (kst_today, 1)
    on conflict (day) do update set count = v.count + 1;
  end if;
  return query
    select
      coalesce((select v.count from public.visits v where v.day = kst_today), 0)::bigint,
      coalesce((select sum(v.count) from public.visits v), 0)::bigint;
end;
$$;

grant execute on function public.record_visit(boolean) to anon;

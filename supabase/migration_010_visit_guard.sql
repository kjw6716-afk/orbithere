-- ============================================
-- 방문 집계 손보기 — 서버 쪽 중복 제거 + 숫자 비공개
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- (migration_009_visits.sql을 이미 실행한 뒤에 돌린다)
-- ============================================
--
-- 009의 record_visit에는 두 가지 구멍이 있었다.
--
-- 1) 도배를 막는 게 아무것도 없었다.
--    posts·comments·reports에는 전부 기기 기준 insert 트리거가 붙어 있는데
--    이 함수만 없었다. anon에 열려 있고 인자도 없다시피 해서, 콘솔에서
--    fetch를 반복하면 숫자를 원하는 만큼 올릴 수 있었다.
--    "같은 기기 하루 한 번"은 클라이언트 localStorage가 맡고 있었는데,
--    그건 부르는 쪽 사정이라 막는 역할을 전혀 하지 못한다.
--
-- 2) 그 숫자를 anon에게 그대로 돌려줬다.
--    조작할 수 있는 값을 공개하면 언젠가 반드시 누가 건드린다.
--
-- 【이번 설계】
--   · 하루 한 번 제한을 서버로 옮긴다 — 기기별 도장을 남기고,
--     이미 찍혀 있으면 visits.count를 올리지 않는다.
--     localStorage는 이제 "요청을 아낀다"는 역할만 한다.
--   · record_visit은 아무것도 돌려주지 않는다(returns void).
--     방문자 화면에 숫자를 띄우지 않기로 했으므로 읽을 이유가 없다.
--     숫자는 관제실에서 visit_stats()로만 본다.
--
-- 【트리거 대신 도장을 쓴 이유】
--   reports_rate_limit 같은 "분·시간당 N회" 트리거를 그대로 복사할까 했지만,
--   여기서는 (기기, 날짜) 유니크가 그 트리거보다 강하다. 같은 기기의 두 번째
--   호출부터는 숫자가 아예 안 움직이므로 "1분에 5번"을 따질 일이 없다.
--   반대로 남는 구멍(UUID를 매번 새로 만들어 부르는 경우)은 기기 기준 트리거로도
--   똑같이 못 막는다 — 이력이 없는 새 기기로 보이기 때문이다. 이건 posts·reports가
--   이미 안고 있는 한계와 같은 것이고, PROJECT_STATUS.md 7항에 적어 두었다.

-- ===== 기기별 하루 도장 =====
-- 기기 식별자를 그대로 넣지 않고 날짜와 섞은 md5만 남긴다.
-- 이렇게 하면 (a) 같은 날 같은 기기는 같은 값이 나와 중복 제거가 되고,
-- (b) 날짜가 바뀌면 값이 완전히 달라져서 날짜를 넘나드는 추적이 안 된다.
-- 방문 집계는 글·답과 달리 "가만히 들어온 사람"까지 남기는 자리라,
-- 원본 기기 ID를 쌓아둘 이유가 없다.
create table if not exists public.visit_pings (
  day   date not null,
  token text not null,
  primary key (day, token)
);

alter table public.visit_pings enable row level security;
-- visits와 같다 — 정책 0개. 아래 security definer 함수로만 드나든다.

-- 009의 함수는 반환 타입이 달라서 replace가 안 된다. 먼저 지운다.
-- (이 줄 때문에 009 → 010 순서를 지켜야 한다)
drop function if exists public.record_visit(boolean);

create or replace function public.record_visit(p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 날짜 기준은 한국 시간(Asia/Seoul)이다. Supabase 서버는 UTC라서
  -- current_date를 그대로 쓰면 오전 9시 전까지 어제로 집계된다.
  kst_today date := (now() at time zone 'Asia/Seoul')::date;
  stamped   int;
begin
  -- 기기 ID 형식은 다른 테이블(author_device·device_id·reporter_device)과 같은 기준.
  -- 빈 문자열이나 한 글자를 보내 도장을 무력화하지 못하게 한다.
  if p_device is null or char_length(p_device) not between 8 and 64 then
    raise exception 'orbit_bad_device';
  end if;

  insert into public.visit_pings (day, token)
  values (kst_today, md5(p_device || ':' || kst_today::text))
  on conflict do nothing;

  get diagnostics stamped = row_count;
  if stamped = 0 then
    return;   -- 오늘 이미 센 기기 — 몇 번을 더 불러도 여기서 끝난다
  end if;

  -- on conflict do update는 원자적이라 동시 접속이 겹쳐도 카운트가 새지 않는다
  insert into public.visits as v (day, count) values (kst_today, 1)
  on conflict (day) do update set count = v.count + 1;

  -- 도장은 그날 하루만 쓸모가 있다. 새 도장을 찍는 김에 오래된 걸 치운다.
  -- (하루 한 번 이하로만 도는 자리라 부담이 없고, day가 PK 앞자리라 인덱스를 탄다.
  --  시간대 차이로 어제 도장이 아직 유효할 수 있어 3일치는 남긴다)
  delete from public.visit_pings where day < kst_today - 3;
end;
$$;

-- 함수를 만들면 PUBLIC에 실행 권한이 기본으로 붙는다. 아래 grant는 그걸 다시
-- 적어주는 것뿐이고 접근을 좁히지 않는다 — 좁히려면 revoke를 써야 한다.
-- 방문 집계는 로그인 없는 방문자가 부르는 게 맞으므로 그대로 둔다.
grant execute on function public.record_visit(text) to anon;

-- ===== 관제실용 조회 =====
-- 숫자를 보는 곳은 admin.html 한 곳뿐이다. report_queue와 같은 방식으로
-- security definer 안에서 관리자 여부를 직접 확인한다.
-- 이 함수를 지키는 건 아래 grant가 아니라 where 절의 is_admin()이다.
-- (함수는 기본으로 PUBLIC 실행 권한을 갖기 때문에 anon도 호출 자체는 할 수 있다.
--  관리자가 아니면 0행이 나간다)
-- total은 모든 행이 같은 값을 물고 온다 — 최근 60일만 보면서 누적도 같이
-- 보여줘야 해서, RPC를 두 번 부르는 대신 열 하나로 붙였다.
create or replace function public.visit_stats()
returns table (day date, count bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.day, v.count,
         (select coalesce(sum(v2.count), 0) from public.visits v2)::bigint
    from public.visits v
   where public.is_admin()
   order by v.day desc
   limit 60;
$$;

grant execute on function public.visit_stats() to authenticated;

-- ============================================
-- 궤도(채널) 개편 — 잡담형 → 천문 관측 주제
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- 2026-08 방향 전환에 맞춰 lounge.html의 ORBIT_LIST를 갈아끼웠다.
--   관측 후기(report) · 장비(gear) · 실시간 하늘(live) · 질문(ask)
--
-- 【옛 id를 재사용하지 않은 이유】
--   free/money/dawn/pet 을 그대로 두고 이름표만 바꾸면(migration_006에서
--   'dawn'을 운동 궤도로 넓혔던 것처럼) 이미 쌓인 재테크 글이 '장비'로,
--   반려동물 글이 '질문'으로 둔갑한다. 이번엔 이름이 넓어진 게 아니라
--   주제가 통째로 바뀐 것이라 새 id를 쓴다.
--
-- 【옛 값을 제약에서 빼지 않는 이유】
--   check 제약을 새로 추가하면 Postgres가 기존 행을 전부 검사한다.
--   옛 값을 빼면 이미 있는 글들이 제약 위반이라 ALTER 자체가 실패한다.
--   그래서 옛 4개 + 새 4개를 모두 허용한다. 옛 글은 lounge.html의
--   orbitInfo() 폴백을 타서 🛰️ 칩에 원래 id가 찍힌 채로 그대로 보인다
--   (탭 목록에는 새 4개만 뜨므로 '전체'에서만 만나게 된다).
--
-- 제약 이름은 schema.sql에서 인라인 선언돼 Postgres가 붙인 posts_orbit_check이다.
-- 혹시 이름이 다르면 아래로 확인할 수 있다:
--   select conname from pg_constraint
--    where conrelid = 'public.posts'::regclass and contype = 'c';

alter table public.posts
  drop constraint if exists posts_orbit_check;

alter table public.posts
  add constraint posts_orbit_check
  check (orbit in (
    -- 현재 궤도
    'report', 'gear', 'live', 'ask',
    -- 지난 궤도 (기존 글 보존용 — 새 글은 UI에서 선택할 수 없다)
    'free', 'money', 'dawn', 'pet'
  ));

-- ===== 옛 글을 정리하고 싶다면 =====
-- 아래는 실행하지 않아도 서비스는 정상 동작한다. 필요할 때만 골라 쓸 것.
--
-- 1) 옛 글이 몇 건이나 남아 있는지 본다
-- select orbit, count(*) from public.posts
--  where orbit in ('free','money','dawn','pet')
--  group by orbit order by count(*) desc;
--
-- 2) 옛 글을 전부 '질문' 궤도로 옮긴다 (되돌릴 수 없다)
-- update public.posts set orbit = 'ask'
--  where orbit in ('free','money','dawn','pet');
--
-- 3) 옛 글을 다 옮겼거나 지웠다면 제약에서 옛 값을 뺀다
-- alter table public.posts drop constraint if exists posts_orbit_check;
-- alter table public.posts
--   add constraint posts_orbit_check
--   check (orbit in ('report', 'gear', 'live', 'ask'));

-- ============================================
-- 반려동물 궤도 추가
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- posts.orbit은 허용 값을 check 제약으로 잠가두었다.
-- lounge.html의 ORBIT_LIST에 줄을 하나 더해도 이 제약을 풀지 않으면
-- 새 궤도에 글을 쓸 때 23514(check constraint) 오류가 난다.
--
-- 제약 이름은 schema.sql에서 인라인으로 선언해 Postgres가 자동으로 붙인
-- posts_orbit_check이다. 혹시 이름이 다르면 아래 쿼리로 확인할 수 있다:
--   select conname from pg_constraint
--    where conrelid = 'public.posts'::regclass and contype = 'c';

alter table public.posts
  drop constraint if exists posts_orbit_check;

alter table public.posts
  add constraint posts_orbit_check
  check (orbit in ('free', 'money', 'dawn', 'pet'));

-- 참고: 궤도를 더 늘릴 때도 이 파일과 같은 방식으로
-- 제약을 다시 만들어 주면 된다. 기존 글의 orbit 값은 그대로 유지된다.

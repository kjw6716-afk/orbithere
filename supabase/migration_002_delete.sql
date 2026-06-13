-- ============================================
-- 마이그레이션 002 — 글 삭제 기능
-- 이미 schema.sql을 적용한 프로젝트에서 추가로 실행
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ============================================

-- 작성 기기 식별 컬럼 (삭제 권한 확인용)
alter table public.posts add column if not exists author_device text;

-- 글 삭제: 작성한 기기에서만 가능하도록 RPC로 제한
-- posts에 직접 delete 정책을 두지 않으므로 임의 삭제는 차단되고,
-- 이 함수만 security definer로 author_device가 일치할 때 삭제한다.
create or replace function public.delete_post(p_id uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.posts where id = p_id and author_device = p_device;
end;
$$;

grant execute on function public.delete_post(uuid, text) to anon;

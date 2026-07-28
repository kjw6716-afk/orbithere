-- ============================================
-- 도배 방지: 궤적(글) 작성 속도 제한
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- 익명 구조라 완벽할 수는 없다 — 기기 ID(localStorage)를 지우면
-- 새 기기가 되므로 작정한 공격자는 우회할 수 있다.
-- 그래도 실수 연타와 단순 스크립트 도배는 여기서 걸린다.
-- IP 기반 제한이 필요해지면 쓰기를 Edge Function 뒤로 옮기는 게 다음 단계.
--
-- 클라이언트(lounge.html의 errHint)는 'orbit_rate_limit' 메시지를 보고
-- "너무 빠르게 남기고 있어요" 안내를 띄우므로 예외 문구를 바꾸면 같이 바꿀 것.

-- 새 글은 작성 기기 식별자를 반드시 갖도록 한다 (제한 우회용 null 차단).
-- NOT VALID: 기존 행(초기 환영 글 등)은 검사하지 않고 새 insert에만 적용된다.
alter table public.posts
  drop constraint if exists posts_author_device_required;
alter table public.posts
  add constraint posts_author_device_required
  check (author_device is not null and char_length(author_device) between 8 and 64)
  not valid;

create or replace function public.posts_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  -- 같은 기기에서 1분에 3개까지
  select count(*) into recent
    from public.posts
   where author_device = new.author_device
     and created_at > now() - interval '1 minute';
  if recent >= 3 then
    raise exception 'orbit_rate_limit';
  end if;

  -- 같은 기기에서 1시간에 20개까지
  select count(*) into recent
    from public.posts
   where author_device = new.author_device
     and created_at > now() - interval '1 hour';
  if recent >= 20 then
    raise exception 'orbit_rate_limit';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit
  before insert on public.posts
  for each row execute function public.posts_rate_limit();

-- 속도 제한 카운트 조회용 인덱스 (author_device + 시간)
create index if not exists posts_device_created
  on public.posts (author_device, created_at desc);

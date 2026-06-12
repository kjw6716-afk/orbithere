-- ============================================
-- Orbit 광장 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ============================================

-- 궤적(글)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  nick text not null check (char_length(nick) between 2 and 12),
  orbit text not null check (orbit in ('free', 'money', 'dawn')),
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

-- 이모지 교차 리액션
create table if not exists public.reactions (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  emoji text not null check (emoji in ('⭐','🔥','😂','🥹','👏','🫶')),
  device_id text not null check (char_length(device_id) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (post_id, emoji, device_id)  -- 같은 기기는 글당 이모지 하나씩
);

-- 조회 인덱스
create index if not exists posts_orbit_created on public.posts (orbit, created_at desc);
create index if not exists rx_post on public.reactions (post_id);

-- Row Level Security
alter table public.posts enable row level security;
alter table public.reactions enable row level security;

-- 누구나 읽기 가능
create policy "posts_read" on public.posts for select using (true);
create policy "rx_read"    on public.reactions for select using (true);

-- 누구나 쓰기 가능 (입력값 제한은 위의 check 제약이 담당)
create policy "posts_insert" on public.posts for insert with check (true);
create policy "rx_insert"    on public.reactions for insert with check (true);

-- 리액션 취소 허용
-- (베타: 익명 구조라 device_id 소유 검증은 불가. 정식 계정 도입 시 auth.uid() 기반으로 강화)
create policy "rx_delete" on public.reactions for delete using (true);

-- 환영 글
insert into public.posts (nick, orbit, text)
values ('Orbit', 'free', '광장이 정식으로 열렸습니다! 이제 궤적이 모두에게 보여요. 첫 궤적을 남겨보세요 🧡');

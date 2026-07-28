-- ============================================
-- 공감 이모지 교체 마이그레이션 (2026-07)
-- 🥹 → 🥰, 🫶 → ❤️ (구형 기기에서 □로 깨지는 유니코드 14 이모지 제거)
--
-- 이미 schema.sql을 실행해 둔 기존 Supabase 프로젝트에서
-- SQL Editor 에 이 파일을 붙여넣고 Run 하세요.
-- (새 프로젝트라면 최신 schema.sql만 실행하면 되고 이 파일은 필요 없습니다)
-- ============================================

-- 1) 옛 이모지 목록으로 걸려 있는 check 제약 해제
alter table public.reactions drop constraint if exists reactions_emoji_check;

-- 2) 이미 쌓인 리액션을 새 이모지로 이전
--    (🥰/❤️는 옛 목록에 없던 값이라 unique(post_id, emoji, device_id) 충돌 없음)
update public.reactions set emoji = '🥰' where emoji = '🥹';
update public.reactions set emoji = '❤️' where emoji = '🫶';

-- 3) 새 이모지 목록으로 check 제약 재설정
alter table public.reactions add constraint reactions_emoji_check
  check (emoji in ('⭐','🔥','😂','🥰','👏','❤️'));

# 작성자 글 수정: 권한과 배포

## 수정 경로

`board_edit_post(p_id uuid, p_title text, p_text text, p_orbit text, p_observation jsonb)`는 수정한 글의 UUID를 반환한다. 클라이언트는 성공 후 같은 글의 상세 내용을 다시 조회한다.

- 공개 함수는 `SECURITY INVOKER`이고, 노출되지 않는 `orbit_post_edit_private` 스키마의 제한된 `SECURITY DEFINER` 함수를 호출한다. 기존 공감·회원 RPC 패턴을 따른다.
- 실제 Auth 사용자에 대해 기존 `require_writer()`를 호출한다. 이메일 인증을 마친 회원과 기존 운영자 작성 조건을 재사용하며, 익명 Auth·인증 전 계정·프로필 설정 전 회원·탈퇴 중 계정은 거부한다.
- 수정 대상은 항상 `author_id = auth.uid()`인 글이다. 운영자도 다른 사람의 글이나 소유자가 없는 이전 글을 수정할 수 없다. 비공개 함수를 직접 호출해도 같은 검사를 거친다.
- 행 잠금 후 `title`, `text`, `orbit`, `observation`, 서버 시각 `edited_at`만 갱신한다. 사진·작성자·작성일·공지·조회수·댓글·공감·읽음 기록·보상·작성 건수는 그대로 둔다. 새 글 생성이나 작성 보상 RPC를 호출하지 않는다.
- 같은 내용을 다시 저장하면 `edited_at`도 그대로 둔다. 과거 글의 `edited_at`은 `NULL`이며 마이그레이션이 과거 글을 수정된 것으로 표시하지 않는다.
- 제목 1–80자, 본문 1–5,000자, 기존 분류 CHECK 및 관측 정보 검증을 유지한다. 작성 폼에서 제목을 비워 두면 기존 `OrbitBoardWriting.title()`가 본문에서 제목을 만들어 전송한다. 서버에 실제 빈 제목을 보내는 요청은 거부한다.
- 양쪽 함수는 `search_path=''`, 명시된 인자와 정적 UPDATE만 사용한다. `PUBLIC`·`anon` 실행 권한을 회수하고 `authenticated`에만 허용한다.

## 공지 권한

작성자용 UPDATE RLS 정책이나 일반 UPDATE column grant를 추가하지 않는다. 기존 `posts_admin_update_pin`의 `USING`/`WITH CHECK`는 모두 `is_admin()`이고, 일반 API에 허용된 UPDATE 컬럼은 `is_pinned`, `pinned_at` 두 개뿐이다. 기존 트리거도 공지 변경 때 관리자 여부를 검사한다.

2026-09-27 운영 DB의 정책·컬럼 권한·함수 정의를 읽어 저장소와 같은 구조임을 확인했다. 관리자 여부는 보호된 `public.admins`에서 검사하며, 사용자 편집 가능 메타데이터나 닉네임을 근거로 삼지 않는다. 이 동작은 변경하지 않았다.

## 마이그레이션과 배포 순서

`supabase/migrations/20260927020259_author_post_edit.sql`은 Supabase CLI 2.118.0의 `migration new author_post_edit`로 생성했다. 추가 내용은 `posts.edited_at` 컬럼 및 SELECT 권한, 전용 스키마와 수정 RPC다. 이미지 파일과 Storage 구조는 바꾸지 않는다.

1. PR 검토가 끝난 뒤 위 마이그레이션을 운영 DB에 적용한다. 기존 클라이언트와 호환되는 추가 변경이다.
2. 수정 RPC 존재와 권한 검사를 확인한 후 이 PR을 병합해 Pages 클라이언트를 배포한다. 새 상세 조회에는 `edited_at`이 포함되므로 DB를 먼저 적용해야 한다.
3. 배포 후 본인 글 수정 및 다른 계정·운영자의 타인 글 수정 거부를 확인한다.

이번 작업에서는 운영 DB를 읽기 전용으로 조사했다. 운영 마이그레이션 적용이나 병합은 실행하지 않았다. 클라이언트를 되돌릴 때는 추가 컬럼과 RPC를 남겨 두어도 기존 동작과 호환된다.

## 검증

`node tests/security.mjs`는 모든 실제 SQL 마이그레이션을 PGlite PostgreSQL에서 실행한다. 새 마이그레이션은 두 번 적용해 재실행 안전성도 검사한다. 단일 연결 테스트이므로 운영 동시 부하 테스트로 해석하지 않는다.

수정 회귀 검증에는 다음을 포함한다.

- 작성자 성공, 다른 회원·운영자의 타인 글·비회원·익명 Auth·인증 전·프로필 설정 전·탈퇴 중 계정 거부
- 공개 RPC와 비공개 helper 직접 호출, 함수 실행 권한과 `search_path`, 기존 UPDATE 권한/정책의 완전 일치
- 제목·본문·분류·관측 정보 검증, 같은 내용 재시도, 서버 수정 시각
- 사진 2장 및 Storage 메타데이터, 댓글, 공감, 조회수, 읽음 기록, 보상, 작성 기록, 게시물 수를 수정 전후 전체 비교
- 글 ID·작성자·기기 ID·닉네임·작성일·사진 경로·공지 상태의 동일성
- 수정 내용에 따른 일반 목록·분류·검색·내 활동 갱신과 첫 글 XP 중복 지급 방지
- 일반 작성자의 공지 변경 거부, 관리자 공지 해제 유지, 관리자 자기 글 수정 가능

운영 보안 advisor도 읽기 전용으로 확인했다. 기존 공개 definer 함수와 익명 접근 정책 등에 대한 경고가 이미 존재했다. 이번 변경은 기존 권한을 확대하지 않고 새 공개 함수에 definer 권한을 부여하지 않으며, 범위 밖 경고를 수정하지 않는다.

참고: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [JavaScript RPC](https://supabase.com/docs/reference/javascript/rpc).

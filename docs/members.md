# 회원 계정과 별빛

회원 DB와 탈퇴 함수는 운영에 적용했고, 화면은 최종 가입 검증 전까지 비활성 상태입니다. `orbit-config.js`의 `membersEnabled:false`는 외부 준비가 끝날 때까지 유지합니다. 실제 인증메일 발송·수신·링크 복귀를 확인하지 않고 활성화하지 않습니다.

## 사용자 기능

- 이메일 가입/인증/로그인/비밀번호 재설정/로그아웃 및 Google OAuth 로그인을 지원합니다. Google 첫 방문은 닉네임·약관 확인만 받고, 이후 미니 프로필로 이동합니다. 익명 세션이 남아 있을 때 `updateUser({email})`로 같은 Auth 사용자에 연결한 후 비밀번호를 설정합니다. 이미 존재하는 다른 계정과 자동 병합하지 않습니다.
- 회원 닉네임은 대소문자를 무시해 중복 제한, 2~12자. 프로필은 닉네임·레벨·경험치 바·가입일만 보이는 미니 카드이며 닉네임 수정·로그아웃·비밀번호 변경·탈퇴 기능을 유지합니다. 상세 지급 기록·출석 일수·배지 선택 UI는 표시하지 않습니다. 상단의 자동 이모지는 제거합니다.
- 출석은 DB의 한국 날짜당 +10, 첫 글은 계정당 +20. 이벤트는 운영자만 생성하고 회원 닉네임으로 30~100 지급, 이벤트/회원당 한 번. 지급 종료와 내역 조회를 지원합니다.
- 누적 XP 문턱은 `5 * (level-1) * level`: Lv.2=10, Lv.10=450, Lv.20=1900. 1~9 / 10~19 / 20~29이며 별도 등급 이름은 없습니다.
- 첫 글, 30일 출석, Lv.10 배지는 서버 기록에서 계산합니다. 받지 않은 배지 선택은 거부합니다.

## 권한·삭제

`orbit_members_private`의 프로필/보상/이벤트 테이블은 RLS를 켜고 클라이언트 직접 접근 권한을 제거했습니다. 공개 RPC는 invoker이며, 개별 권한을 받은 private definer가 `auth.uid()` 및 실제 `auth.users.is_anonymous/email_confirmed_at`를 검사합니다. `user_metadata`는 UI의 비밀번호 설정 안내에만 쓰며 권한·별빛·운영자 판단에 사용하지 않습니다.

탈퇴 Edge Function은 `getUser()`로 bearer JWT를 검증하고 5분 이내 password AMR 또는 서버가 확인한 Google identity와 oauth AMR을 확인합니다. Google 탈퇴는 재로그인 후 원래 사용자 ID와 동일한지 검사하고, 별도 최종 삭제 확인을 받습니다. 계정이 바뀌면 재인증 상태를 폐기합니다. 요청 body의 사용자 ID를 사용하지 않습니다. service role은 함수 환경에서만 읽습니다. 운영자 탈퇴는 차단합니다. 회원 동결 → Storage API로 실제 사진 삭제 → 본인 공개 활동 삭제 → Auth Admin API 삭제 → FK cascade로 개인별 프로필/보상/읽음 기록 제거 순서입니다. 실패하면 동결 상태로 남고 사용자가 탈퇴를 다시 실행해 이어갑니다. Storage 메타데이터를 SQL로 삭제하지 않습니다.

`member-withdraw`는 `verify_jwt:false`로 배포하되 함수 본문의 `getUser()` 검증이 필수입니다. 새 publishable key/서명 키와 기존 Edge gateway 검사 차이를 피하기 위한 명시적 자체 인증입니다. 인증·최근 본인 확인 이전에는 서비스 권한 클라이언트를 생성하지 않습니다.

## 운영 설정과 공개 전 확인

- Google 프로젝트 `orbithere-auth`, 앱 `오빗 Orbit`을 프로덕션 상태로 설정했습니다. 로그인 범위는 openid·email·profile이며 홈페이지·방침·약관 링크와 `orbithere.com`을 등록했습니다. OAuth 비밀키는 Supabase에만 저장합니다.
- Supabase Google provider와 Manual linking을 켰으며 Email·Confirm email·Anonymous sign-in을 유지합니다. Site URL은 `https://orbithere.com`, 허용 복귀 주소는 `/account.html`, `/account.html?flow=recovery`, `/account.html?flow=google-withdraw` 세 개입니다.
- Resend 무료 플랜의 `auth.orbithere.com`이 DNS 인증을 마쳤습니다. Tokyo 발송, TLS 필수, 클릭·열람 추적 도메인을 만들지 않습니다. SMTP는 `smtp.resend.com:465`, 사용자 `resend`, 발신자는 `오빗 Orbit <accounts@auth.orbithere.com>`입니다. 발송 전용 키는 이 도메인으로 제한합니다.
- 방침에는 Google 제공 항목과 Resend의 미국 보관·메일/로그 30일 보관, 인증메일의 국외 처리를 반영합니다. 상세 근거는 각 사업자 공식 문서입니다.
- 운영 마이그레이션 `20260914092001_member_accounts_levels`, `member-withdraw` v1을 적용했습니다. 글·댓글 내용 지문과 Auth 계정 4개가 유지됐습니다. Advisor의 새 WARN은 없고, 직접 접근을 차단한 private 테이블 3개의 RLS no-policy INFO만 추가됐습니다.
- 실제 인증메일 발송·수신·복귀 및 Google 로그인 확인 후 공개 플래그와 최종 배포 상태를 기록합니다. 기존 운영자 계정은 탈퇴 시험에 사용하지 않습니다.

## 검증

- `node tests/security.mjs`: 실제 전체 마이그레이션을 PGlite에 두 번 적용. 기존 144개 + 회원 권한/XP/삭제 54개.
- `node tests/members.mjs`: 실제 Supabase JS SDK와 브라우저, 모든 외부 HTTP를 fixture로 차단. 가입/연결/로그아웃/복구/동의/배지/탈퇴/모바일/홈·게시판 연결.
- `node tests/member-withdraw.mjs`: 실제 Edge handler의 인증/최근 비밀번호/타인 ID 무시/실패·재시도/Storage→Auth 순서 28개.
- 기존 커뮤니티 173개, 링크, 천문, 렌더링, 첫 화면, 콘텐츠, 공통 메뉴와 이야기 회귀 검사.

공식 참고: [익명 계정 연결](https://supabase.com/docs/guides/auth/auth-anonymous), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [이메일 비밀번호 인증](https://supabase.com/docs/guides/auth/passwords).

Google 버튼 아이콘은 [공식 배포 자산](https://developers.google.com/identity/branding-guidelines)의 Neutral / Android+Web / Square SVG를 수정 없이 사용합니다.

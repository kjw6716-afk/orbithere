# 회원 계정과 별빛

이 변경은 구현·검증용 초안이며 회원 기능은 아직 운영 DB나 사이트에 적용하지 않았습니다. `orbit-config.js`의 `membersEnabled:false`는 외부 준비가 끝날 때까지 유지합니다. 실제 인증메일 발송·수신·링크 복귀를 확인하지 않고 활성화하지 않습니다.

## 사용자 기능

- 이메일 가입/인증/로그인/비밀번호 재설정/로그아웃. 익명 세션이 남아 있을 때 `updateUser({email})`로 같은 Auth 사용자에 연결한 후 비밀번호를 설정합니다. 이미 존재하는 다른 계정과 자동 병합하지 않습니다.
- 회원 닉네임은 대소문자를 무시해 중복 제한, 2~12자. 프로필은 닉네임·레벨·경험치 바·가입일만 보이는 미니 카드이며 닉네임 수정·로그아웃·비밀번호 변경·탈퇴 기능을 유지합니다. 상세 지급 기록·출석 일수·배지 선택 UI는 표시하지 않습니다. 상단의 자동 이모지는 제거합니다.
- 출석은 DB의 한국 날짜당 +10, 첫 글은 계정당 +20. 이벤트는 운영자만 생성하고 회원 닉네임으로 30~100 지급, 이벤트/회원당 한 번. 지급 종료와 내역 조회를 지원합니다.
- 누적 XP 문턱은 `5 * (level-1) * level`: Lv.2=10, Lv.10=450, Lv.20=1900. 1~9 / 10~19 / 20~29이며 별도 등급 이름은 없습니다.
- 첫 글, 30일 출석, Lv.10 배지는 서버 기록에서 계산합니다. 받지 않은 배지 선택은 거부합니다.

## 권한·삭제

`orbit_members_private`의 프로필/보상/이벤트 테이블은 RLS를 켜고 클라이언트 직접 접근 권한을 제거했습니다. 공개 RPC는 invoker이며, 개별 권한을 받은 private definer가 `auth.uid()` 및 실제 `auth.users.is_anonymous/email_confirmed_at`를 검사합니다. `user_metadata`는 UI의 비밀번호 설정 안내에만 쓰며 권한·별빛·운영자 판단에 사용하지 않습니다.

탈퇴 Edge Function은 `getUser()`로 bearer JWT를 검증하고 5분 이내 password AMR을 확인합니다. 요청 body의 사용자 ID를 사용하지 않습니다. service role은 함수 환경에서만 읽습니다. 운영자 탈퇴는 차단합니다. 회원 동결 → Storage API로 실제 사진 삭제 → 본인 공개 활동 삭제 → Auth Admin API 삭제 → FK cascade로 개인별 프로필/보상/읽음 기록 제거 순서입니다. 실패하면 동결 상태로 남고 사용자가 탈퇴를 다시 실행해 이어갑니다. Storage 메타데이터를 SQL로 삭제하지 않습니다.

`member-withdraw`는 `verify_jwt:false`로 배포하되 함수 본문의 `getUser()` 검증이 필수입니다. 새 publishable key/서명 키와 기존 Edge gateway 검사 차이를 피하기 위한 명시적 자체 인증입니다. 인증·최근 비밀번호 확인 이전에는 서비스 권한 클라이언트를 생성하지 않습니다.

## 공개 전 필요한 확인

1. 대시보드 로그인 완료. Custom SMTP는 꺼져 있으며 발송 서비스 선택·연결이 필요합니다. 기본 SMTP는 팀 주소 등으로 제한되므로 공개 회원가입용으로 가정하지 않습니다. SMTP 비밀번호나 API 키를 문서·Git·대화에 넣지 않습니다.
2. Email provider와 Confirm email을 유지하고, 익명 계정 이메일 연결에 필요한 Manual linking을 활성화해야 합니다(현재 꺼짐). 현재 Site URL은 `http://localhost:3000`이고 redirect 목록은 비어 있습니다. 공개 전에 Site URL을 `https://orbithere.com`으로 변경하며, 허용 Redirect URL은 `https://orbithere.com/account.html` 및 `https://orbithere.com/account.html?flow=recovery`입니다. 무제한 와일드카드를 추가하지 않습니다.
3. 실제 사용하는 메일 사업자, 처리 항목·목적·보관·처리지역/국외이전 해당 사항을 확인해 개인정보처리방침의 메일 사업자 보완 문장을 확정합니다. 방침 시행일과 동의 버전은 실제 공개 시점에 맞춥니다. 현재 방침 수정은 초안입니다.
4. 마이그레이션을 적용하고 보안 advisor를 비교합니다. 기존 INFO/WARN과 새 사항을 구분합니다. Edge Function의 `index.ts`와 `handler.mjs`를 함께 배포합니다.
5. 운영자가 관리하는 테스트 계정으로 새 가입→인증메일→로그인, 익명 글→이메일 연결→작성자 ID 유지, 비밀번호 재설정, 별빛 중복 방지, 탈퇴 완료를 실제 확인합니다. 기존 운영자 계정을 탈퇴 테스트에 사용하지 않습니다.
6. 위 검증이 완료된 커밋에서 `membersEnabled:true`로 바꾸고 CI 확인 후 병합합니다. Pages 배포 후 홈/게시판/프로필을 확인합니다.

## 검증

- `node tests/security.mjs`: 실제 전체 마이그레이션을 PGlite에 두 번 적용. 기존 144개 + 회원 권한/XP/삭제 54개.
- `node tests/members.mjs`: 실제 Supabase JS SDK와 브라우저, 모든 외부 HTTP를 fixture로 차단. 가입/연결/로그아웃/복구/동의/배지/탈퇴/모바일/홈·게시판 연결.
- `node tests/member-withdraw.mjs`: 실제 Edge handler의 인증/최근 비밀번호/타인 ID 무시/실패·재시도/Storage→Auth 순서 22개.
- 기존 커뮤니티 173개, 링크, 천문, 렌더링, 첫 화면, 콘텐츠, 공통 메뉴와 이야기 회귀 검사.

공식 참고: [익명 계정 연결](https://supabase.com/docs/guides/auth/auth-anonymous), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [이메일 비밀번호 인증](https://supabase.com/docs/guides/auth/passwords).

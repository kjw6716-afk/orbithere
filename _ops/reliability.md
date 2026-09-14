# 운영 장애 확인과 복구

## 게시판 초안 및 배포

- 회원 상태 확인이 늦게 끝나도 작성 중인 제목/본문의 포커스를 옮기지 않는다. 편집 화면을 떠났다면 늦은 응답을 무시한다.
- `tests/community.mjs`는 응답을 의도적으로 늦춘 상태에서 제목 포커스와 실패 후 제목/본문의 실제 문자열을 확인한다.
- GitHub Pages의 Source는 **GitHub Actions**로 설정한다. `검사` 워크플로의 `check`가 성공해야 같은 SHA를 `deploy`한다. PR 실행은 배포하지 않는다.
- 뉴스/이야기 봇의 GITHUB_TOKEN 푸시는 일반 push 워크플로를 시작하지 않으므로 `checks.yml`을 명시적으로 dispatch한다.
- Jekyll을 유지하고 `_editorial`이 배포 결과에 없는지 확인한다. 검사가 실패하면 기존 배포가 유지된다.

## 인증메일 실패 알림

Resend → 서명 검증 Edge Function → 비공개 DB → 관제실 `운영 상태`.

- 수신: `email.bounced`, `email.suppressed`, `email.failed`, `email.complained`, `email.delivery_delayed`.
- ORBIT 인증 발신 주소 `accounts@auth.orbithere.com`의 단일 수신자 메일만 저장한다.
- 함수 `mail-delivery-events`의 `verify_jwt=false`는 Resend 웹훅용이다. 원본 요청 본문의 Svix 서명, 시각, 이벤트 ID를 먼저 검증한다. 서명이 없거나 오래된 요청은 401. 비밀키 설정 누락/DB 장애는 503으로 재시도를 유도한다.
- `RESEND_WEBHOOK_SECRET`은 Supabase Edge Function Secrets에만 보관한다. 저장소/브라우저 코드/문서에 넣지 않는다. Svix 2.x의 `verify`는 JSON을 반환하지 않으므로 검증 뒤 명시적으로 파싱한다.
- Resend endpoint: `https://unwxpuvfqyjhgrcrmuhu.supabase.co/functions/v1/mail-delivery-events`.
- DB `orbit_ops_private.delivery_events`는 직접 조회할 수 없다. 서비스 전용 기록 RPC, 관리자 판정을 거치는 조회/확인 RPC를 분리한다.
- 메일 본문, 인증번호, 제목, 원본 SMTP 응답을 저장하지 않는다. 기록은 최근 30일만 노출하며 매일 03:35 KST에 기간이 지난 기록을 정리한다.
- 관제실이 열린 동안 1분마다 새로 확인한다. ‘확인했어요’는 읽음 처리이고 차단 해제/재발송을 수행하지 않는다.
- **실패 알림이 없다는 사실만으로 인증메일 전송 전체가 정상임을 보장하지 않는다.** Resend에 도달하기 전 Auth/SMTP 연결 오류는 Supabase Auth 로그도 확인한다. 이 기능은 연결 이후 수신된 이벤트를 기록하며 과거 로그를 자동 수집하지 않는다.
- 가입자 문의 시: 반송/차단 상태와 원인을 확인 → 주소/휴면 해제 여부 확인 → 필요한 경우 운영자가 Resend 차단 해제 → 사용자가 인증메일 재요청. 다른 주소의 차단을 일괄 해제하지 않는다.

## 뉴스 갱신

- 기본 수집: UTC `17 */2 * * *` (2시간 간격). 공개 캐시를 먼저 저장하고 배포 검사를 요청한다. 선택적인 번역 초안 생성은 별도 job에서 수행한다.
- 감시: 매시 47분 `뉴스 갱신 지연 감지·복구`가 **공개된** `data/news.json`을 확인한다.
- 마지막 수집이 4시간을 넘거나 모든 수집원이 실패하면 기존 뉴스 수집 워크플로를 재요청한다. 진행/대기 중인 수집이 있으면 중복 요청하지 않으며 최근 45분 내 시도도 건너뛴다.
- `checkedAt`만 보지 않고 각 수집원의 `status`, `lastSuccessfulAt`도 확인한다. 일부 수집원 장애는 관제실에 구분 표시한다.
- 복구 요청 성공은 공개 갱신 완료와 다르다. `검사` → `deploy` 성공과 공개 JSON의 `checkedAt`을 확인한다.
- GitHub 예약 실행은 지연/누락될 수 있다. 감시도 같은 GitHub scheduler를 쓰므로 정확한 2시간 갱신을 보장하지 않는다. 더 엄격한 주기가 필요하면 GitHub와 독립된 예약 실행 기반으로 옮긴다.

## 검증

`npm run test:operations`, `npm run test:security`, `npm run test:community` 및 전체 `검사` 워크플로. 웹훅 연결 후 Resend 테스트/재전달에서 HTTP 200을 확인하고, 잘못된 서명의 직접 호출이 401인지 확인한다. 실제 회원 주소로 시험 발송하지 않고 [Resend 공식 테스트 주소](https://resend.com/docs/dashboard/emails/send-test-emails)를 이용한다. 테스트 후 임시 미인증 계정과 시험 이벤트를 정리한다.

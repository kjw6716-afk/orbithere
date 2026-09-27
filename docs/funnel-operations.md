# 사용 퍼널 운영·배포 절차

측정 의미와 제외 범위는 [측정 명세](funnel-measurement.md)를 먼저 읽는다. 이 문서는 migration 실행 또는 merge 승인을 대신하지 않는다. 실제 방문·검색 수치와 검색어는 공개 저장소/PR에 붙이지 않는다.

## 추가 구조

`20260927041435_minimal_funnel_analytics.sql` 하나만 추가한다. 기존 Auth·회원·글·댓글·공감·방문 카운터 스키마나 작성 권한은 바꾸지 않는다.

- `orbit_funnel_private.events`: 임시 세션, 순서, 허용된 이벤트·기능·상세·페이지 키·시작 회원 여부·표시 방식, 서버 수신 시각. RLS 활성, 클라이언트 테이블 권한 없음.
- `daily`: 세션 ID 없는 KST 일별 숫자. `settings`: 설치 시각. 두 테이블도 RLS와 비공개 권한.
- `record_funnel_event(p_event)`: anon/authenticated의 유일한 쓰기 경로. 키 8개, 512바이트, 타입·조합·UUIDv4·1~128 순서 검증. 세션 잠금과 유일 제약으로 중복 제거. 서버는 회원용 UUID를 생성하지 않는다.
- `funnel_report(p_from,p_to)`: 실제 관리자 또는 service_role만 일별 퍼널을 읽는다. 날짜 양끝 포함, KST 최근 400일 이내. `partial_today`, `partial_installation_day`, `before_installation`, `raw_window`, `finalized`, `unavailable`을 구분한다. 설치 첫날은 불완전한 날짜로 표시하며 설치 전·유실 기간을 0으로 채우지 않는다.
- `funnel_member_report(p_from,p_to)`: 실제 관리자 또는 service_role만 기존 DB에서 최대 366일 구간의 회원·기여·재방문·기존 카운터를 집계한다. UUID를 반환하거나 새 이벤트와 조인하지 않는다.
- `maintain_funnel_analytics()`: service_role만 수동 실행 가능. 매일 KST 03:45 (`45 18 * * *` UTC) `orbit-funnel-retention` cron이 같은 비공개 함수를 실행한다. 마감된 날짜 집계 후 30일 경과 원본, 400일 범위 밖 일별 집계를 삭제한다.

공개 함수는 invoker wrapper이며 비공개 definer 함수는 모두 빈 search_path와 명시적 스키마를 사용한다. 집계 함수는 역할과 `public.admins`를 다시 검사하므로 비공개 함수를 직접 불러도 권한을 우회할 수 없다. user_metadata는 권한 판단에 사용하지 않는다.

## 읽는 방법

인증된 관리자는 RPC를 사용한다. SQL Editor의 운영용 연결에서는 아래처럼 service_role로 한 트랜잭션 안에서 조회할 수 있다. 서비스 키를 브라우저나 공개 파일에 넣지 않는다.

```sql
begin read only;
set local role service_role;
-- 오늘을 제외한 직전 7일: p_to는 포함하는 마지막 날짜이다.
select public.funnel_report(
  (now() at time zone 'Asia/Seoul')::date-7,
  (now() at time zone 'Asia/Seoul')::date-1);
select public.funnel_member_report(
  (now() at time zone 'Asia/Seoul')::date-7,
  (now() at time zone 'Asia/Seoul')::date-1);
commit;
```

28일은 시작일을 `today-28`로 바꾼다. `days[].metrics`의 같은 지표를 합산한다. 일별 고유 세션은 KST 날짜마다 새 ID이므로 합산할 수 있지만 고유 사람 수가 되지는 않는다. 회원 수는 일별 합산하지 않고 기간 전체 member_report 결과를 사용한다. 불완전/없는 날짜가 있으면 기간 전체의 완전한 값으로 표현하지 않는다.

|질문|분자 필드|분모 필드|
|---|---|---|
|검색 유입 비중|sources.google + naver + other_search|sessions|
|비회원으로 시작한 규모|guest_sessions|sessions (비중이 필요할 때)|
|랜딩별 비중|landing_pages의 해당 키|sessions|
|기능 열람|features.X.view_sessions|sessions|
|도구 준비|features.X.ready_after_view_sessions|features.X.view_sessions|
|실제 도구 사용|features.X.used_after_ready_sessions|features.X.ready_after_view_sessions|
|기능 → 게시판|features.X.board_after_view_sessions|features.X.view_sessions|
|게시판 → 글쓰기|write_after_board_sessions|board_view_sessions|
|글쓰기 → 인증 화면/시도|auth_open_after_write_sessions / auth_attempt_after_write_sessions|write_start_sessions|
|인증 코호트의 첫 남은 참여|contributions.K.cohort_first_retained_members|contributions.K.cohort_denominator|
|회원 다른 날짜 재방문|members_with_prior_date|visiting_members|

율은 항상 `분자 / 분모`와 함께 표시하고 0인 분모에서는 계산하지 않는다. `events_without_session_start`는 수집 손실 신호이며 세션 분모에 넣지 않는다. 수신된 session_start조차 없는 완전한 누락은 알 수 없다. 4초 시간 제한·광고차단·저장소 차단·인증 상태 확인 실패로 수집이 빠질 수 있다. 계측은 기존 회원 초기화가 완료되기를 기다릴 수 있지만 화면/로그인/글쓰기는 이를 기다리지 않는다.

`verified_accounts_in_cohort`는 기간 내 인증일을 가진 현재 남은 영구 계정이다. 로그인 성공 횟수가 아니다. 기존 Auth가 익명에서 전환되면 Auth created_at과 회원 인증일은 다르다. `first_retained_*`는 삭제되지 않고 남아 있는 기여의 최초이며 역대 최초가 아니다. `legacy_null_author_rows`는 신뢰할 회원 연결이 없는 과거 행이다. 관리자 제외 뒤에도 운영자 소유의 일반 계정이 남을 수 있다.

## 제외와 검증 환경

- 운영자·수동 QA는 사이트 방문 전에 해당 브라우저의 `orbit_analytics_exclude` 값을 `1`로 설정한다. 이는 추적 식별자가 아닌 제외 설정이다. 해제하려면 해당 키를 제거한다.
- 실제 관리자 프로필이 확인되면 브라우저도 수집하지 않는다. 클라이언트는 apikey만 보내므로 서버는 이 요청을 회원과 연결하지 않는다. 별도 bearer를 붙인 직접 RPC에서는 서버 관리자 제외도 동작한다.
- localhost/다른 호스트·webdriver·명백한 crawler는 새 계측에서 제외한다. 봇이 UA를 속이거나 호출자가 새 UUID를 계속 만들면 위조를 완전히 막을 수 없다. 원문 IP/UA·fingerprint를 저장하지 않는다.
- 기존 visits/member_visit/게시글 조회는 별개다. 운영 smoke test는 새 제외 설정만 믿지 말고 기존 방문·출석·조회 등 모든 쓰기 요청도 브라우저에서 차단한다. 자동 테스트는 로컬 파일과 모의 백엔드만 사용한다.
- 저장소의 `npm test`와 CI가 기존 계정 전환 회귀 및 새 `test:funnel`을 함께 실행한다. 새 브라우저 검사는 모든 요청을 직접 응답하거나 중단하며 운영 요청을 통과시키지 않는다.

## 적용 전 승인 자료

1. PR의 최신 commit과 CI 성공을 확인한다. 개인정보처리방침의 실제 시행일·공지 및 분석 처리 근거/동의 필요성을 확인한다. 기존 회원 동의 버전은 새 분석 동의 증거가 아니다.
2. 운영 프로젝트 ref가 `unwxpuvfqyjhgrcrmuhu`인지 확인한다. 기존 migration은 이름 기준으로 대조한다. 과거 파일 생성 시각과 운영 적용 버전이 다른 항목을 다시 적용하지 않는다. 신규 SQL 하나만 적용한다.
3. **사용자 승인 후** 추가형 migration을 실행한다. 기존 데이터를 삭제하지 않으며 purge 대상은 새 schema뿐이다. `pg_cron`과 새 예약의 존재·활성을 확인한다. 로컬 WASM은 cron을 실행하지 못하므로 별도 fixture로 등록 명령·재실행을 검사한다.
4. 일반 anon/authenticated의 원시 테이블·전체 집계·정리 접근 거부, 정상 수집 형식, 민감 텍스트/임의 키 거부, 관리자 집계 권한을 검증한다. 운영에서 테스트 수집 행을 만드는 대신 역할/카탈로그 조회와 트랜잭션 rollback을 사용한다.
5. 사용자 승인 범위 안에서 코드 merge → 검사·Pages SHA 일치 → 핵심 파일 바이트 대조 → 제외된 소량 브라우저 검증 순서로 진행한다. 먼저 코드만 배포하면 존재하지 않는 RPC로 표본이 버려진다.

## 삭제와 장애 대응

```sql
-- 운영자 SQL 연결에서 최근 스케줄 상태를 읽는다.
select jobid,jobname,schedule,active from cron.job where jobname='orbit-funnel-retention';
select status,start_time,end_time from cron.job_run_details
where jobid in (select jobid from cron.job where jobname='orbit-funnel-retention')
order by start_time desc limit 7;

-- 필요한 경우 권한 있는 운영 연결에서 수동으로 동일 정리를 실행한다.
begin;
set local role service_role;
select public.maintain_funnel_analytics();
commit;
```

원본 삭제는 수신 시각 기준 30일 경과 후 일일 작업이 담당한다. 작업 실패 중에는 예정 보존 기간을 초과할 수 있으므로 운영자는 실패와 최신 성공 시각을 확인하고 수동 정리한다. 마감 집계는 원본 삭제 후 다시 0으로 덮어쓰지 않는다. 정리 장애가 원본 복구 가능 기간을 넘으면 없는 날은 unavailable로 남긴다. 데이터가 없다는 것과 사용자 0명이라는 것은 다르다.

코드 롤백 시 원시 이벤트를 만들던 호출만 중단한다. 비공개 schema와 정리 예약은 남겨 원본 만료 삭제가 계속되게 한다. 기존 게시판/회원 테이블을 되돌리지 않는다. 별도 승인 없는 schema 삭제·기존 기록 복원·Gmail 예약 변경은 하지 않는다.

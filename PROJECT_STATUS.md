# PROJECT STATUS — Orbit (orbithere.com)

> 인수인계용 현황 문서. 2026-08-03 기준, 코드에서 확인된 사실만 기록. 추측·계획·마케팅 문구 없음.
> 각 항목 옆 `파일:줄` 은 근거 위치.
>
> **2026-08-02 방향 전환** — 생활밀착형 잡담 커뮤니티에서 **밤하늘 관측 커뮤니티**로 좁혔다.
> Lucky Orbit(복권 추첨기)·오늘의 운세는 `_archive/`로 내렸고, 홈 패널과 프로필 페이지는 없앴다.
>
> **2026-08-03** — 방문 집계(`visits.js`)의 하루 한 번 제한을 서버로 옮기고,
> 방문자에게 보이던 숫자 위젯을 관제실로 내렸다. `live` 채널 30초 폴링 추가.
>
> **2026-08-03 (2)** — 콘텐츠 페이지 `planets.html`(오늘 밤 행성) 추가.
> DB·마이그레이션 변경 없음. localStorage 키 `orbit_place` 하나가 늘었다(`privacy.html` 4항 반영 완료).
> main의 탭이 2개 → 3개가 됐다.
>
> **2026-08-03 (3)** — **레포에 처음으로 자동 검사가 생겼다.** `tests/` 세 개 + GitHub Actions.
> 사이트 자체는 여전히 빌드 스텝이 없고, `package.json`은 검사 스크립트 전용이다.
> 밤하늘 달력의 «다음 현상» 카드가 일정이 비거나 멀 때 오늘 밤 행성으로 이어진다.
>
> **이 문서를 고쳐야 하는 때** — 파일을 추가·삭제했을 때, 마이그레이션을 추가했을 때,
> localStorage 키를 늘렸을 때(`privacy.html`도 같이), 채널 구성을 바꿨을 때.
> 틀린 인수인계 문서는 없느니만 못하다.

---

## 1. 파일 트리

```
orbithere/
├── index.html          랜딩
├── main.html           커뮤니티 홈 (앱 셸 · 사이드바 2탭 + 궤도 진입 대화상자)
├── sky.html            밤하늘 달력  ← 첫 화면
├── planets.html        오늘 밤 행성 (행성 위치·밝기 계산 · 하늘 지도 · 시각 스크러버)
├── tests/              자동 검사 — 사이트 배포물이 아니다
│   ├── astronomy.mjs   planets.html의 계산부만 떼어내 검증 (브라우저 불필요)
│   ├── links.mjs       내부 링크 · sitemap · canonical/OG · localStorage 키 문서화 (브라우저 불필요)
│   └── render.mjs      실제로 그려보고 검사 (playwright)
├── package.json        검사 스크립트 전용. 사이트에는 빌드 스텝이 없다
├── .github/workflows/checks.yml   push(main) · PR 마다 위 셋을 돌린다
├── lounge.html         글 남기기 (Supabase 게시판)
├── admin.html          관제실 (관리자 로그인 · 신고함 · 업데이트 기록)
├── terms.html          이용약관
├── privacy.html        개인정보처리방침
├── 404.html
├── orbit.css           공통 스타일 (색 변수 · 상단바 · 푸터 · reduced-motion)
├── effects.js          클릭 파티클 (canvas + rAF)
├── visits.js           방문 집계 — record_visit RPC를 하루 한 번 호출만 한다(화면 출력 없음)
│                       index · main · sky · planets · lounge 다섯 페이지에 <script defer>로 들어간다
├── _archive/           사이트에서 내렸지만 보관 중 — README.md 참고
│   ├── lucky.html      Lucky Orbit (로또 / 연금복권 추첨기)
│   ├── fortune.html    오늘의 운세
│   └── README.md       내린 이유 · 되살리는 방법
├── supabase/
│   ├── schema.sql                   posts · reactions · delete_post
│   ├── migration_002_delete.sql     author_device 컬럼 · delete_post
│   ├── migration_003_rate_limit.sql
│   ├── migration_004_comments.sql   comments · delete_comment · rate limit
│   ├── migration_005_admin.sql      admins · is_admin · reaction_summary/counts · delete_reaction
│   ├── migration_006_pet_orbit.sql  orbit 제약에 'pet' 추가
│   ├── migration_007_reports.sql    reports · report_queue · resolve_report
│   ├── migration_008_sky_orbits.sql orbit 제약에 관측 채널 4개 추가  ← 미적용 시 글 작성 불가
│   ├── migration_009_visits.sql     visits 테이블 · record_visit(boolean)
│   ├── migration_010_visit_guard.sql visit_pings(기기별 하루 도장) · record_visit(text) · visit_stats
│   │                                 ← 009의 record_visit을 drop하므로 009 다음에 실행
│   └── migrate_emoji_2026-07.sql    🥹→🥰, 🫶→❤️ 이전
├── images/{og.png, otter.png}
├── favicon.* / icon-192.png / icon-512.png / apple-touch-icon*.png
├── CNAME (orbithere.com) · robots.txt · sitemap.xml(7개 URL) · site.webmanifest
└── README.md
```

빌드 산출물 없음(`node_modules`는 `.gitignore`, `dist` 없음). `.github`는 검사 워크플로 하나뿐이다.

---

## 2. 기술 스택

| 항목 | 실제 |
|---|---|
| 프레임워크 | **없음.** 순수 HTML/CSS/JS. 빌드 스텝·번들러·패키지 매니저 없음 |
| JS | ES5 스타일 IIFE 위주, 일부 `async/await`. 각 페이지 `<script>` 인라인 |
| 외부 라이브러리 | Pretendard 폰트 (jsDelivr CDN), `@supabase/supabase-js@2` (CDN, `lounge.html`·`admin.html` 두 곳만) |
| 백엔드/DB | **Supabase** (PostgreSQL + PostgREST + Auth). 프로젝트 URL `unwxpuvfqyjhgrcrmuhu.supabase.co`, publishable 키가 소스에 하드코딩 — `lounge.html`, `admin.html`, `visits.js` **3곳 중복** (방문 집계가 들어오면서 2곳 → 3곳). `visits.js`만 supabase-js 없이 REST(`/rest/v1/rpc/...`)를 직접 부른다 |
| 서버 코드 | 없음. Edge Function 없음. 모든 권한 판정은 Postgres RLS + `security definer` 함수 |
| 인증 | Supabase Auth (이메일/비번) — **관리자 전용**. 일반 사용자 인증 없음 |
| 배포 | **GitHub Pages**, 레포 루트를 그대로 서빙. `CNAME`으로 커스텀 도메인. Pages 설정은 레포 설정 화면에 있고 코드에 없음. 푸시 = 배포 |
| 검사 | `.github/workflows/checks.yml` — push(main)·PR마다 `tests/` 셋을 돌린다. **배포를 막지는 못한다**(Pages가 워크플로를 거치지 않으므로). 무엇이 깨졌는지 알려줄 뿐이다 |
| SEO | 페이지별 canonical/OG/twitter 메타, `sky.html`·`planets.html`에 JSON-LD (WebApplication + FAQPage), sitemap 7개 URL, `admin.html`·`_archive/*`는 noindex + robots Disallow |
| 접근성 | `prefers-reduced-motion` 전역 처리 (`orbit.css:154-173`, `effects.js:12-13`), iOS 자동확대 방지용 input 16px |

---

## 3. 화면 목록

| 파일 | 한 줄 설명 |
|---|---|
| `index.html` | 유성우 + 공전하는 별 애니메이션 랜딩. 아무 데나 클릭하면 700ms 뒤 `main.html`로 이동 |
| `main.html` | 사이드바 + 패널 앱 셸. **밤하늘 달력 / 오늘 밤 행성 / 글 남기기 3탭**, 셋 다 `?embed=1` iframe. 상단 칩을 누르면 궤도 진입(닉네임) 대화상자 |
| `sky.html` | 유성우·일식·월식·슈퍼문 일정표 + 실시간 카운트다운 + 달 위상 계산. **첫 화면** |
| `planets.html` | 행성 7개의 방향·고도·밝기·거리를 그날 날짜로 계산. 하늘 지도(SVG) + 밤 시간대 스크러버 + 관측지 8곳 + 근접(합) 안내. **하드코딩된 일정표가 없다** |
| `lounge.html` | 궤도(채널)별 게시판. 글쓰기·리액션·댓글·삭제·신고. 유일한 실제 커뮤니티 화면 |
| `admin.html` | 운영자 로그인 → **방문 집계** + 신고함 처리 + 업데이트 기록(v0.1~v1.5) 열람 |
| `terms.html` / `privacy.html` | 이용약관 / 개인정보처리방침 (전문 작성됨) |
| `404.html` | 커스텀 404 |

**궤도(채널) 구성** — `lounge.html`의 `ORBIT_LIST` 한 곳에서 정의한다. DB의 `posts_orbit_check` 제약과 **같이** 고쳐야 한다.

| id | 라벨 | 비고 |
|---|---|---|
| `report` | 📝 관측 후기 | **첫 진입 기본 채널.** 해시가 없으면 여기로 온다 (`lounge.html:494`). `sky.html` CTA도 `#report`로 들어온다 |
| `gear` | 🔭 장비 | `minor:true` |
| `live` | 🌌 실시간 하늘 | `minor:true` · **이 채널만 30초 폴링** |
| `ask` | ❓ 질문 | `minor:true` |
| `free` | 💬 자유게시판 | `minor:true` · 2026-08 개편 때 내렸던 옛 `free` id를 그대로 되살린 채널이라 **DB 제약은 손댈 필요가 없다**(migration_008에 이미 허용돼 있다). 옛 자유 글도 이 탭에 다시 보인다 |
| `all` | 🌠 전체 | 목록에 없는 특수 탭. `#all`로 진입 |

`minor:true`는 탭을 `opacity:0.6`으로 한 톤 낮춘다(`lounge.html:57-60`). 빈 채널 네 개가 똑같이 크게 보이면 "빈 방 4개"로 읽히므로, 유입이 몰리는 시기에는 후기 궤도만 또렷하게 두려는 장치다. hover·선택 시에는 100%로 돌아온다.

---

## 4. 기능별 상태

| 기능 | 상태 | 근거 |
|---|---|---|
| **로그인** | **없음** (일반 사용자) / **완성** (관리자만) | 일반 사용자는 인증 자체가 없다. 닉네임을 localStorage에 저장하는 게 전부 — 비밀번호·세션·서버 계정 없음. 관리자는 `admin.html:528` Supabase `signInWithPassword` + `admins` 테이블 등재 여부(`is_admin()`)로 판정, 실제 동작 |
| **프로필** | **없음** | `profile.html` 삭제(2026-08-02). 레벨·XP·스탯이 전부 정적 값이라 내렸다. 지금은 상단 칩에 닉네임이 뜨는 것이 전부 |
| **글쓰기** | **완성** | `lounge.html` posts insert. 500자 제한, 채널 선택, DB check 제약, 기기당 1분 3개/1시간 20개 rate limit, 작성 기기 기준 삭제, 댓글(300자), 신고까지 |
| **피드** | **완성** | 채널별/전체 최신 50개 + 리액션 집계 RPC + 댓글 일괄 로드 + 채널 새로고침. 페이지네이션 없음(50개가 상한) |
| **live 채널 폴링** | 완성 | `lounge.html:1133-1151`. `live` 탭에 있을 때만 30초 `setInterval`, `document.hidden`이면 건너뛰고 `visibilitychange`로 돌아올 때 즉시 따라잡는다. Realtime 구독은 아니고 폴링이다. **요청 예산**은 아래 7항 참고 |
| **방문 집계** | 완성 (비공개) | `visits.js` + migration_009/010. 하루 한 번 `record_visit(p_device)` 호출. 숫자는 **방문자에게 보이지 않고** 관제실에서만 본다 |
| **레벨링** | **없음** | 유일한 UI였던 `profile.html`과 함께 제거. XP를 더하거나 레벨을 올리는 코드는 원래도 없었다 |
| **매칭** | **없음** | 매칭·추천·팔로우·친구·DM 관련 코드·UI·테이블이 전무 |
| 궤도 진입(닉네임) | **완성** | `main.html` 대화상자. 2~12자 검증(서버 check 제약과 동일 기준), 닉네임 바꾸기·지우기. 광장에서 `postMessage({orbit:'join'})` 또는 `main.html#join`으로도 열린다 |
| 이모지 리액션 | 완성 | 6종, 낙관적 업데이트 + 실패 롤백. `reaction_summary` RPC로 device_id 비노출 |
| 댓글 | 완성 | 펼침 상태 유지, 개별 새로고침 |
| 신고 | 완성 | 5개 사유 + 상세, (대상,기기) 유니크, 관제실 신고함에서 삭제/무시 처리 |
| 관리자 삭제 | 완성 | RLS `is_admin()` 기반. 클라이언트 `isAdmin` 변수는 버튼 표시용일 뿐 |
| 밤하늘 달력 | 완성 | 달 위상 천문 계산 직접 구현. 이벤트 일정은 하드코딩 |
| **오늘 밤 행성** | 완성 | `planets.html`. JPL 근사 궤도요소(Standish, 1800~2050)로 행성 위치를 직접 계산 → 지평좌표 변환. KST 정오부터 24시간을 5분 간격 289개 표본으로 훑어 뜨고 지는 시각·최고 고도를 구한다. 서버 호출 0회 |
| 업데이트 기록 | 완성 | 관제실에서만 열람 |

---

## 5. 데이터 모델 (PostgreSQL / Supabase)

**posts** — 궤적(글)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| nick | text | 2~12자 |
| orbit | text | 현재: `report`·`gear`·`live`·`ask` / 보존: `free`·`money`·`dawn`·`pet` |
| text | text | 1~500자 |
| author_device | text | 8~64자, NOT NULL (migration_003, NOT VALID) |
| created_at | timestamptz | `now()` |

**comments** — id uuid PK / post_id → posts(**cascade**) / nick 2~12 / text 1~300 / author_device 8~64 NOT NULL / created_at
**reactions** — id bigint identity / post_id → posts(cascade) / emoji ∈ `⭐🔥😂🥰👏❤️` / device_id 8~64 / created_at / **unique(post_id, emoji, device_id)**
**reports** — id uuid / target_type ∈ `post`,`comment` / target_id uuid / reason ∈ `spam,abuse,adult,privacy,etc` / detail ≤200 / reporter_device 8~64 / handled bool / created_at / **unique(target_type, target_id, reporter_device)**
**admins** — user_id uuid PK → auth.users(cascade) / note / created_at. RLS 켜고 정책 0개 = REST로 아무도 못 읽음
**visits** — day date PK / count bigint. 날짜별 방문 수 하나가 전부. RLS 켜고 정책 0개
**visit_pings** — day date + token text 복합 PK. token은 `md5(기기ID || ':' || 날짜)` — 원본 기기 ID를 쌓지 않으면서 "같은 기기 같은 날 한 번"을 서버에서 강제한다. 날짜가 바뀌면 값이 완전히 달라져 날짜 간 연결이 안 된다. 3일보다 오래된 행은 새 도장을 찍을 때 함께 지운다. RLS 켜고 정책 0개

**RLS 요약**: posts·comments·reactions·reports 모두 insert는 누구나. select는 posts·comments만 공개(reactions·reports는 닫힘). delete 정책은 관리자에게만. 일반 사용자 삭제는 `delete_post` / `delete_comment` / `delete_reaction` RPC(기기 일치 시에만)로만.
**RPC**: `delete_post` `delete_comment` `delete_reaction` `reaction_summary` `reaction_counts` `is_admin` `report_queue` `resolve_report` `record_visit`(anon, returns void) `visit_stats`(관리자 전용)
**트리거**: posts/comments/reports 각각 insert rate limit (3·20 / 5·50 / 5·30 per 분·시간)
**방문 집계의 도배 방지**는 트리거가 아니라 `visit_pings`의 복합 PK다. 같은 기기의 두 번째 호출부터 `on conflict do nothing`에 걸려 `visits.count`가 움직이지 않는다 — 기기 기준 "분당 N회" 트리거보다 강하다. 이유는 `migration_010` 주석 참고.

> `reaction_counts` 는 홈 트렌딩 카드 전용이었다. 카드를 없애면서 **호출하는 곳이 사라졌지만 함수는 남겨 두었다** — 지우려면 별도 마이그레이션이 필요하다.

**localStorage**
`orbit_nickname` `orbit_joindate` `orbit_jointime` `orbit_device_id` `orbit_visit_day` `orbit_place`
(`orbit_place`는 `planets.html`의 관측 도시 id. 서버로 가지 않는 화면 설정값이다)
(레거시: `orbit_zodiac` `orbit_animal` — 운세 페이지를 내리면서 더 이상 읽고 쓰지 않음)

> **키를 추가할 때는 `privacy.html` 4항(브라우저 저장소 목록)을 반드시 같이 고칠 것.**
> `orbit_device_id`가 한 번 누락됐고(2026-08-02 수정), `orbit_visit_day`가 같은 이유로 또 누락됐다(2026-08-03 수정).
> 서버에 새로 보내는 값이 생기면 1항 수집 표·2항 이용 목적·3항 보관 파기·시행일까지 함께 본다.

---

## 6. TODO · 주석처리 · 하드코딩 더미

- **TODO/FIXME/HACK 주석은 레포 전체에 0건.** 주석은 전부 "왜 이렇게 했는지" 설명형이고 품질이 높다.
- 주석처리된 코드
  - `migration_005_admin.sql:136-138` — 관리자 등록 `insert into admins`가 통째로 주석. `ADMIN_UID_HERE` 자리표시자. **실제 운영 UID는 레포에 없음**(의도적). 같은 파일 142-143의 확인 쿼리도 주석
  - `migration_008_sky_orbits.sql` 하단 — 옛 궤도 글을 정리하는 3단계 쿼리가 주석. 실행하지 않아도 서비스는 정상 동작 (단 `free`가 자유게시판으로 되살아나 2)·3)은 그대로 쓰면 안 된다)
- 하드코딩 상수
  - `sky.html:451-586` — 천문 이벤트 14건 전부 하드코딩 (2026-08 ~ 2027-08)
  - `admin.html` — 업데이트 기록 v0.1~v1.5 타임라인이 정적 HTML
  - `lounge.html` — 채널 목록 `ORBIT_LIST` 상수 (DB에 채널 테이블 없음)
  - `planets.html` — `ELEM`(JPL 궤도요소 표)·`PLANETS`(행성 설명)·`PLACES`(관측지 8곳). 궤도요소는 **1800~2050년용 상수표**라 2050년 이후에는 오차가 커진다
  - `schema.sql:63-64` — 환영 글 1건을 seed로 insert
- **가짜 더미 데이터는 없다.**
- 사용되지 않는 파일: `images/otter.png`(어디서도 참조 안 됨 — 마스코트는 상단 칩의 🦦 이모지), `apple-touch-icon-180x180.png`(참조 0건)
- 제거된 기능의 잔재: "오늘의 떡밥" 탭이 `admin.html` 업데이트 기록에만 남아 있고 코드에는 없음

---

## 7. 안 돌아가는 것 / 깨진 것

**실제 결함**
1. `sky.html` — 하드코딩된 마지막 이벤트가 **2027-08-02**. 그 이후 타임라인은 빈 상태로 고정되고 수동 갱신이 필요하다. 다만 «다음 현상» 카드는 더 이상 죽지 않는다 — 일정이 비면 오늘 밤 행성으로 안내한다(`sky.html:showAlt`). **일정 갱신 자체는 여전히 사람 몫이다**
2. `schema.sql` 의 orbit check는 여전히 `('free','money','dawn')`뿐이다. **새 Supabase 프로젝트에 schema.sql만 실행하면 글 작성이 23514로 실패**한다. `schema.sql → 002 → 003 → … → 009 → 010` 순서대로 전부 실행해야 함
3. 마이그레이션 실행 순서 의존 — migration_003 적용 후 `schema.sql`을 다시 돌리면 마지막 환영 글 insert가 실패한다 (author_device 없음)

**2026-08-03에 고친 것**
- ~~`sky.html`의 마지막 현상이 지나가는 순간 숫자판에 «9일 7시간 55분»이 굳은 채 남고 1초 타이머도 계속 돌았다~~ → 빈 상태에서 `nxUnits`를 비우고 `__nxTimer`를 정리한다 (`tests/render.mjs`가 지킨다)
- ~~하늘 지도에서 행성이 몰리면 이름표가 위로만 밀려나 이웃 행성 점에 붙었다 (실제로 «화성»이 천왕성 점에 붙음)~~ → 점 둘레 여덟 방향 + 이웃 반대쪽에서 자리를 찾고, 자기 점이 가장 가까운 자리만 쓰며, 글자색을 천체 색에 맞추고, 그래도 떨어지면 선으로 잇는다
- ~~`terms.html`·`privacy.html`에 og:image가 없어 링크 미리보기가 빈 카드였다~~ → 추가 (`tests/links.mjs`가 지킨다)
- ~~`record_visit`에 도배 방지가 없어 콘솔에서 반복 호출하면 숫자를 얼마든지 올릴 수 있었다~~ → 하루 한 번 제한을 서버(`visit_pings`)로 옮김. localStorage는 요청을 아끼는 역할만 한다
- ~~조작 가능한 방문자 수를 페이지에 그대로 노출~~ → `record_visit`은 아무것도 반환하지 않고, 숫자는 관제실 `visit_stats`로만 본다
- ~~privacy.html이 `orbit_visit_day` 누락~~ → 저장소 목록·수집 표·이용 목적·보관 파기 반영, 시행일 2026-08-03로 갱신

**2026-08-02에 고친 것**
- ~~privacy.html이 기기 식별자(`author_device`/`device_id`/`reporter_device`) 수집을 누락~~ → 수집 표·이용 목적·보관 파기·localStorage 목록에 모두 반영, 시행일 갱신
- ~~profile.html의 XP 라벨(0/100)과 막대(3%) 불일치~~ → 페이지 자체 제거
- ~~profile.html 스탯이 항상 0~~ → 페이지 자체 제거

**설계상 한계 (코드 주석에 이미 명시된 것들)**
- 익명 기기 ID 기반이라 localStorage를 지우면 새 기기가 되어 rate limit·중복 신고 방지를 우회할 수 있다
- 닉네임 선점 없음 — 같은 닉을 여러 명이 쓸 수 있고, 그래서 '나' 배지·삭제 권한을 닉이 아닌 `author_device`로 판단한다
- 광장은 최신 50개 고정. 페이지네이션·무한스크롤 없음. Supabase Realtime 구독도 없다 — `live` 채널의 30초 폴링이 유일한 자동 갱신이다
- **폴링 요청 예산** — `loadPosts()` 한 번이 쿼리 3개(글 50개 + `reaction_summary` RPC + 댓글 일괄 조회)다. `live` 탭을 열어둔 브라우저 하나가 시간당 120회 × 3쿼리를 쓴다. 탭을 켜둔 채 밤을 넘기면 하룻밤에 천 회에 가까워진다. 지금 인원으로는 무료 플랜에 여유가 있지만, **유입이 몰리는 날에는 Supabase 대시보드에서 사용량을 확인할 것.** 부담되면 `lounge.html:1142`의 `30000`을 `60000`으로 올리면 된다
- 방문 집계는 기기당 하루 한 번이지만, localStorage를 지우거나 UUID를 새로 만들어 부르면 새 기기로 잡힌다 — posts·reports의 rate limit이 안고 있는 한계와 같다. 기기 기준 트리거로도 막히지 않는 종류이므로 **정확한 수치가 아니라 추세로 읽어야 한다**
- `planets.html`의 궤도요소는 1800~2050년용 근사표다. 2050년을 넘기면 오차가 눈에 띄게 커지고, 그때는 표를 갈아야 한다. 밝기(등급)는 근사식이고 **토성의 고리 기울기 보정이 빠져 있어** 최대 0.5등급쯤 어긋날 수 있다. 대기 굴절·지형 가림·날씨는 반영하지 않는다 (이 한계들은 페이지의 «계산 안내» 상자에 그대로 적어 두었다)
- Supabase URL/키가 3개 파일에 복붙돼 있어 프로젝트 교체 시 3곳을 고쳐야 한다
- Supabase가 일시정지되면 광장 전체가 "서버에 연결할 수 없어요"로 죽는다
- 옛 궤도(`money`/`dawn`/`pet`) 글은 '전체' 탭에서 🛰️ 폴백 칩(원래 id 표시)으로 보인다. 정리 쿼리는 migration_008 주석 참고 (`free`는 자유게시판으로 되살아나 폴백 대상이 아니다 — 옛 자유 글은 자유게시판 탭에 그대로 뜬다)

**`_archive/` 노출 위험**: 밑줄로 시작하는 디렉터리는 GitHub Pages의 Jekyll 빌드에서 제외되므로 공개되지 않는다. 다만 `.nojekyll`을 추가하거나 Pages 배포를 GitHub Actions로 바꾸면 **그대로 공개된다.** 안전망으로 두 파일에 noindex meta와 robots Disallow를 넣어 두었다.

**`planets.html` 계산 검증 (2026-08-03)**: 헤드리스 브라우저와 Node로 다음을 확인했다 — 태양 적경·적위(오차 0.2° 이내), 지구 근일점·원일점(1월 초 0.9833 au / 7월 초 1.0167 au), 수성·금성 최대이각(27.8° / 46.9°), 행성별 태양거리 범위, **서울 일출·일몰이 공표값과 1분 이내**(하지·동지·연초 3개 날짜), 같은 값을 시간각 해석식으로 다시 구해 교차검증(4개 날짜, 2분 이내), 남중 방위 180.1°, 달 근지점·원지점 거리와 8월 삭 날짜(2026-08-13 — 밤하늘 달력의 «8월 12일이 신월» 서술과 일치), 행성 7개의 연중 밝기 범위, 밤 시간대 36개 프레임에서 지도 라벨 겹침 0건.

**자동 검사가 지키는 것** (`npm test`): 천문 계산 11항목, 내부 링크·sitemap·canonical/OG·localStorage 키 문서화, 하늘 지도 이름표의 주인·겹침(오늘 밤 54개 시각 + 일부러 몰아 놓은 배치), 지도와 요약 문장의 일치, 관측지 8곳, 좁은 화면 가로 넘침과 글자 크기, 임베드 높이 동기화, 키보드 조작, 밤하늘 달력의 빈 일정 처리.
> 검사가 실제로 버그를 잡는지 확인하려면 고친 로직을 되돌려 보면 된다 — 옛 이름표 배치로 되돌리면 `[2] 몰린 배치` 항목이 «화성 → 천왕성 점에 더 가깝다»로 실패한다.

**확인 못 한 것**: 라이브 사이트 실제 동작, Supabase 프로젝트의 실제 마이그레이션 적용 상태, GitHub Pages 설정값 — 레포 코드만으로는 알 수 없다.

---

## 8. 이 프로젝트는 누구를 위한 서비스인가

**코드에서 명확히 읽힌다.**

- **한국어 사용자 전용.** 모든 페이지 `lang="ko"`, 다국어 처리 전무, 한국 표준시(KST) 기준 일정, 🇰🇷 국내 관측 가능 필터
- **밤하늘을 직접 보러 다니는 사람들을 위한 커뮤니티.** 채널 4개가 관측 후기 / 장비 / 실시간 하늘 / 질문 — 관측이라는 단일 활동을 중심으로 후기·장비·속보·입문 질문이라는 활동 단계별 구성이다
- **입문자를 배제하지 않는다.** '질문' 궤도 설명이 "뭐부터 봐야 할지, 저건 뭔지 — 무엇이든 물어보는 궤도", 밤하늘 달력 본문도 "그래서 오늘 밤 몇 시에 어디를 보면 되냐"에 답하는 것을 목표로 명시한다
- **검색으로 유입시켜 커뮤니티로 보내는 구조.** 밤하늘 달력에 JSON-LD와 FAQ 본문을 붙이고, 하단 CTA("별 보러 갔다 왔다면 →")로 관측 후기 궤도에 연결한다
- **진입 장벽을 극단적으로 낮춘 익명 서비스.** 회원가입·로그인·이메일 없음, 닉네임 두 글자면 글을 쓴다
- **톤은 우주/궤도 은유로 통일.** 글=궤적, 채널=궤도, 가입=궤도 진입, 댓글=답, 관리자 페이지=관제실
- **혼자 운영하는 소규모 서비스.** 문의 창구가 별도 이메일이 아니라 "글 남기기에 남겨주세요", 관리자 계정은 `admins` 테이블에 UID를 직접 넣는 방식

**불명확한 것**: 타깃의 연령·성별·직업 같은 구체적 페르소나는 코드에서 읽히지 않는다. 장비 궤도(망원경·적도의·카메라)가 있는 걸 보면 취미에 돈을 쓰는 층을 상정한 듯하나, 그 이상은 근거가 없다. 수익 모델 코드도 전무하다(privacy.html 6항에 향후 광고 가능성만 언급).

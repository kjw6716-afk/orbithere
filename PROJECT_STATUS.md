# PROJECT STATUS — Orbit (orbithere.com)

> 인수인계용 현황 문서. 2026-08-02 기준, `main` 브랜치 커밋 `d079a63` 시점의 코드에서 확인된 사실만 기록.
> 추측·계획·마케팅 문구 없음. 각 항목 옆 `파일:줄` 은 근거 위치.

---

## 1. 파일 트리

```
orbithere/
├── index.html          랜딩
├── main.html           커뮤니티 홈 (앱 셸 · 사이드바 + 패널)
├── lounge.html         대화 광장 (Supabase 게시판)
├── profile.html        프로필 카드
├── lucky.html          Lucky Orbit (로또 / 연금복권 추첨기)
├── fortune.html        오늘의 운세
├── sky.html            밤하늘 달력
├── admin.html          관제실 (관리자 로그인 · 신고함 · 업데이트 기록)
├── terms.html          이용약관
├── privacy.html        개인정보처리방침
├── 404.html
├── orbit.css           공통 스타일 (색 변수 · 상단바 · 푸터 · reduced-motion)
├── effects.js          클릭 파티클 (canvas + rAF)
├── supabase/
│   ├── schema.sql                 posts · reactions · delete_post
│   ├── migration_002_delete.sql   author_device 컬럼 · delete_post
│   ├── migration_003_rate_limit.sql
│   ├── migration_004_comments.sql comments · delete_comment · rate limit
│   ├── migration_005_admin.sql    admins · is_admin · reaction_summary/counts · delete_reaction
│   ├── migration_006_pet_orbit.sql  orbit check 제약에 'pet' 추가
│   ├── migration_007_reports.sql  reports · report_queue · resolve_report
│   └── migrate_emoji_2026-07.sql  🥹→🥰, 🫶→❤️ 이전
├── images/{og.png, otter.png}
├── favicon.* / icon-192.png / icon-512.png / apple-touch-icon*.png
├── CNAME (orbithere.com) · robots.txt · sitemap.xml · site.webmanifest
└── README.md
```

빌드 산출물·의존성 디렉터리 없음(`node_modules`, `dist`, `.github` 모두 부재).

---

## 2. 기술 스택

| 항목 | 실제 |
|---|---|
| 프레임워크 | **없음.** 순수 HTML/CSS/JS. 빌드 스텝·번들러·패키지 매니저 없음 |
| JS | ES5 스타일 IIFE 위주, 일부 `async/await`. 각 페이지 `<script>` 인라인 |
| 외부 라이브러리 | Pretendard 폰트 (jsDelivr CDN), `@supabase/supabase-js@2` (CDN, `lounge.html:440`·`admin.html:371` 두 곳만) |
| 백엔드/DB | **Supabase** (PostgreSQL + PostgREST + Auth). 프로젝트 URL `unwxpuvfqyjhgrcrmuhu.supabase.co`, publishable 키가 소스에 하드코딩 — `main.html:590-591`, `lounge.html:443-444`, `admin.html:374-375` **3곳 중복** |
| 서버 코드 | 없음. Edge Function 없음. 모든 권한 판정은 Postgres RLS + `security definer` 함수 |
| 인증 | Supabase Auth (이메일/비번) — **관리자 전용**. 일반 사용자 인증 없음 |
| 배포 | **GitHub Pages**, 레포 루트를 그대로 서빙. `CNAME`으로 커스텀 도메인. CI/워크플로 파일 없음 → Pages 설정은 레포 설정 화면에 있고 코드에 없음. 푸시 = 배포 |
| SEO | 페이지별 canonical/OG/twitter 메타, `fortune.html`·`sky.html`에 JSON-LD (WebApplication + FAQPage), sitemap 8개 URL, `admin.html`은 noindex + robots Disallow |
| 접근성 | `prefers-reduced-motion` 전역 처리 (`orbit.css:154-173`, `effects.js:12-13`), iOS 자동확대 방지용 input 16px |

---

## 3. 화면 목록

| 파일 | 한 줄 설명 |
|---|---|
| `index.html` | 유성우 + 공전하는 별 애니메이션 랜딩. 아무 데나 클릭하면 700ms 뒤 `main.html`로 이동 |
| `main.html` | 사이드바 + 패널 앱 셸. 홈/광장/Lucky/운세/밤하늘 5탭, 뒤 4개는 `?embed=1` iframe 지연 로딩. 홈에 공지·닉네임 등록 카드·실제 DB에서 뽑은 인기 글 카드 |
| `lounge.html` | 궤도(채널)별 게시판. 글쓰기·리액션·댓글·삭제·신고. 유일한 실제 커뮤니티 화면 |
| `profile.html` | localStorage 닉네임 기반 프로필 카드. 아바타·가입일·궤도 일수·레벨 바·스탯 3칸 |
| `lucky.html` | 로또 6/45 · 연금복권 720+ 번호 추첨기. 흘러가는 번호를 «지금!»으로 포착 |
| `fortune.html` | 별자리 12 / 띠 12 선택 → 날짜 시드 기반 오늘의 운세 (총운·애정·금전·직장·계절·요일·행운 숫자/색/아이템) |
| `sky.html` | 유성우·일식·월식·슈퍼문 일정표 + 실시간 카운트다운 + 달 위상 계산 |
| `admin.html` | 운영자 로그인 → 신고함 처리 + 업데이트 기록(v0.1~v1.4) 열람 |
| `terms.html` / `privacy.html` | 이용약관 / 개인정보처리방침 (전문 작성됨) |
| `404.html` | 커스텀 404 |

---

## 4. 기능별 상태

### 요청하신 6개

| 기능 | 상태 | 근거 |
|---|---|---|
| **로그인** | **없음** (일반 사용자) / **완성** (관리자만) | 일반 사용자는 인증 자체가 없다. `main.html:563` 에서 닉네임을 localStorage에 저장하는 게 전부 — 비밀번호·세션·서버 계정 없음. 관리자는 `admin.html:518` Supabase `signInWithPassword` + `admins` 테이블 등재 여부(`is_admin()`)로 판정, 실제 동작 |
| **프로필** | **껍데기만** | 실제로 살아있는 값은 닉네임·가입일·궤도 일수(경과일 계산, `profile.html:326-334`)뿐. 나머지는 HTML에 박힌 상수 |
| **글쓰기** | **완성** | `lounge.html:569` posts insert. 500자 제한, 채널 선택, DB check 제약, 기기당 1분 3개/1시간 20개 rate limit, 작성 기기 기준 삭제, 댓글(300자), 신고까지 |
| **피드** | **완성** | `lounge.html:593` 채널별/전체 최신 50개 + 리액션 집계 RPC + 댓글 일괄 로드 + 채널 새로고침. 실시간 구독·페이지네이션은 없음(50개가 상한) |
| **레벨링** | **껍데기만** | `profile.html:257-259` `Lv.1 신성 탐험가`, `0 / 100 XP` 가 정적 텍스트. XP를 더하거나 레벨을 올리는 코드가 레포 어디에도 없다 |
| **매칭** | **없음** | 매칭·추천·팔로우·친구·DM 관련 코드·UI·테이블이 전무. 전체 검색 결과 0건 |

### 나머지 기능

| 기능 | 상태 | 비고 |
|---|---|---|
| 이모지 리액션 | 완성 | 6종, 낙관적 업데이트 + 실패 롤백. `reaction_summary` RPC로 device_id 비노출 |
| 댓글 | 완성 | 펼침 상태 유지, 개별 새로고침 |
| 신고 | 완성 | 5개 사유 + 상세, (대상,기기) 유니크, 관제실 신고함에서 삭제/무시 처리 |
| 관리자 삭제 | 완성 | RLS `is_admin()` 기반. 클라이언트 `isAdmin` 변수는 버튼 표시용일 뿐 (`lounge.html:476-479`) |
| 홈 인기 글 카드 | 완성 | REST 2회로 실제 DB 조회, 글 없거나 실패하면 카드 숨김 |
| Lucky Orbit | 완성 | `crypto.getRandomValues` + 모듈로 편향 제거 + 피셔-예이츠. 결과 저장 기능 없음(명시됨) |
| 오늘의 운세 | 완성 | mulberry32 시드 = 날짜×100 + 인덱스. 항목 점수 3개 평균 = 총운. 클립보드 복사 |
| 밤하늘 달력 | 완성 | 달 위상 천문 계산 직접 구현. 이벤트 일정은 하드코딩 |
| 업데이트 기록 | 완성 | 관제실로 이관됨. 과거 `main.html#updates` 해시 탭은 제거됨 |

---

## 5. 데이터 모델 (PostgreSQL / Supabase)

**posts** — 궤적(글)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| nick | text | 2~12자 |
| orbit | text | `free`\|`money`\|`dawn`\|`pet` (dawn = 화면상 "운동 궤도") |
| text | text | 1~500자 |
| author_device | text | 8~64자, NOT NULL (migration_003, NOT VALID) |
| created_at | timestamptz | `now()` |

**comments** — id uuid PK / post_id → posts(**cascade**) / nick 2~12 / text 1~300 / author_device 8~64 NOT NULL / created_at
**reactions** — id bigint identity / post_id → posts(cascade) / emoji ∈ `⭐🔥😂🥰👏❤️` / device_id 8~64 / created_at / **unique(post_id, emoji, device_id)**
**reports** — id uuid / target_type ∈ `post`,`comment` / target_id uuid / reason ∈ `spam,abuse,adult,privacy,etc` / detail ≤200 / reporter_device 8~64 / handled bool / created_at / **unique(target_type, target_id, reporter_device)**
**admins** — user_id uuid PK → auth.users(cascade) / note / created_at. RLS 켜고 정책 0개 = REST로 아무도 못 읽음

**RLS 요약**: posts·comments·reactions·reports 모두 insert는 누구나. select는 posts·comments만 공개(reactions·reports는 닫힘). delete 정책은 관리자에게만. 일반 사용자 삭제는 `delete_post` / `delete_comment` / `delete_reaction` RPC(기기 일치 시에만)로만.
**RPC**: `delete_post` `delete_comment` `delete_reaction` `reaction_summary` `reaction_counts` `is_admin` `report_queue` `resolve_report`
**트리거**: posts/comments/reports 각각 insert rate limit (3·20 / 5·50 / 5·30 per 분·시간)

**localStorage (서버 없음)**
`orbit_nickname` `orbit_joindate` `orbit_jointime` `orbit_device_id` `orbit_zodiac` `orbit_animal`

---

## 6. TODO · 주석처리 · 하드코딩 더미

- **TODO/FIXME/HACK 주석은 레포 전체에 0건.** 주석은 전부 "왜 이렇게 했는지" 설명형이고 품질이 높다.
- 주석처리된 코드: `migration_005_admin.sql:136-138` — 관리자 등록 `insert into admins`가 통째로 주석. `ADMIN_UID_HERE` 자리표시자. **실제 운영 UID는 레포에 없음** (의도적). 같은 파일 143-144의 등록 확인 쿼리도 주석
- 하드코딩 상수:
  - `profile.html:257-259, 266-284` — `Lv.1 신성 탐험가`, `0 / 100 XP`, 궤적 `0`, 연결된 별 `0`, 태그 `🆕 신규 멤버`·`β 베타 참여자`. 궤도 일수만 계산값
  - `profile.html:343` — XP 막대 폭 `3%` 를 무조건 지정
  - `sky.html:453-588` — 천문 이벤트 14건 전부 하드코딩 (2026-08 ~ 2027-08)
  - `fortune.html:~150-548` — 운세 문구 배열 (OVERALL 40 / LOVE 24 / MONEY / WORK / SEASONS / WEEKDAYS / COLORS / ITEMS) 전부 상수
  - `admin.html:226-365` — 업데이트 기록 v0.1~v1.4 타임라인이 정적 HTML
  - `lounge.html:449-458` — 채널 목록 `ORBIT_LIST` 상수 (DB에 채널 테이블 없음)
  - `schema.sql:63-64` — 환영 글 1건("광장이 정식으로 열렸습니다!")을 seed로 insert
- **가짜 더미 데이터는 없다.** 홈 인기 글 카드(`main.html:585-634`)의 주석에 "가짜 하드코딩 문구 대신 실제 글" 이라고 명시돼 있고 실제로 DB를 읽는다
- 사용되지 않는 파일: `images/otter.png`(어디서도 참조 안 됨 — 마스코트는 `main.html:307`의 🦦 이모지로 대체), `apple-touch-icon-180x180.png`(참조 0건)
- 제거된 기능의 잔재: "오늘의 떡밥" 탭이 `admin.html:301` 업데이트 기록에만 남아 있고 코드에는 없음

---

## 7. 안 돌아가는 것 / 깨진 것

**실제 결함**
1. `profile.html` — 라벨은 `0 / 100 XP`인데 막대는 3%로 채워진다. 숫자와 그래프 불일치
2. `profile.html` — 스탯 "궤적"·"연결된 별"이 DB에 글이 쌓여도 영원히 `0`. 집계 코드 없음
3. `supabase/schema.sql:11` — orbit check가 `('free','money','dawn')`뿐이라 **새 Supabase 프로젝트에 schema.sql만 실행하면 반려동물 궤도 글쓰기가 23514로 실패**한다. migration_006까지 반드시 실행해야 함
4. 마이그레이션 실행 순서 의존 — migration_003의 `posts_author_device_required` 적용 후에 `schema.sql`을 다시 돌리면 마지막 환영 글 insert가 실패한다 (author_device 없음)
5. `privacy.html:115-120` — localStorage 목록에 `orbit_device_id`·`orbit_zodiac`·`orbit_animal`이 빠져 있고, 1항 수집 표에도 기기 식별자(author_device / device_id / reporter_device)가 없다. 코드와 방침 문서 불일치
6. `sky.html` — 하드코딩된 마지막 이벤트가 **2027-08-02**. 그 이후에는 카운트다운이 "예정된 현상이 없습니다"(`sky.html:616`)로, 타임라인은 빈 상태로 고정된다. 수동 갱신 필요

**설계상 한계 (코드 주석에 이미 명시된 것들)**
- 익명 기기 ID 기반이라 localStorage를 지우면 새 기기가 되어 rate limit·중복 신고 방지를 우회할 수 있다 (`migration_003:8-13`에 명시)
- 닉네임 선점 없음 — 같은 닉을 여러 명이 쓸 수 있고, 그래서 '나' 배지·삭제 권한을 닉이 아닌 `author_device`로 판단한다
- 광장은 최신 50개 고정. 페이지네이션·무한스크롤·실시간 구독 없음
- Supabase 프로젝트 URL/키가 3개 파일에 복붙돼 있어 프로젝트 교체 시 3곳을 고쳐야 한다
- Supabase 무료 플랜이 일시정지되면 광장 전체가 "서버에 연결할 수 없어요"로 죽는다 (`lounge.html:654-655`에 그 케이스 문구가 준비돼 있음)

**확인 못 한 것**: 라이브 사이트 실제 동작, Supabase 프로젝트의 실제 마이그레이션 적용 상태, GitHub Pages 설정값 — 레포 코드만으로는 알 수 없다.

---

## 8. 이 프로젝트는 누구를 위한 서비스인가

**코드에서 명확히 읽힌다.**

- **한국어 사용자 전용.** 모든 페이지 `lang="ko"`, 다국어 처리 전무, 한국 표준시(KST) 기준 일정, 🇰🇷 국내 관측 가능 필터, 한국도박문제예방치유원 1336 안내
- **특정 관심사 커뮤니티가 아니라 "일상 잡담 + 소소한 재미" 커뮤니티.** 채널 4개가 자유(잡담·일상·혼잣말) / 재테크(투자·절약·돈) / 운동(러닝·헬스·홈트) / 반려동물 — 취미·직군 특화가 전혀 없는, 생활밀착형 일반 주제 구성
- **검색으로 유입시켜 커뮤니티로 보내는 구조.** 로또 번호 생성기·오늘의 운세·밤하늘 달력이라는 검색 수요가 큰 도구 3개에 JSON-LD와 FAQ 본문을 붙여 놓고, 각 페이지 하단에서 "광장에 자랑하러 가기"·"광장에서 나눠보세요" CTA로 커뮤니티에 연결한다 (`lucky.html:275-278`, `fortune.html`의 `.cta-lounge`). 업데이트 기록에도 `검색 유입` 태그가 반복 등장
- **진입 장벽을 극단적으로 낮춘 익명 서비스.** 회원가입·로그인·이메일 없음, 닉네임 두 글자면 글을 쓴다. "회원가입 없이 무료로"가 운세·복권 페이지 카피에 반복된다
- **톤은 우주/궤도 은유로 통일.** 글=궤적, 채널=궤도, 가입=궤도 진입, 댓글=답, 관리자 페이지=관제실
- **혼자 운영하는 소규모 서비스.** 문의 창구가 별도 이메일이 아니라 "대화 광장에 남겨주세요"(`terms.html:132`, `privacy.html:138`), 관리자 계정은 `admins` 테이블에 UID를 직접 넣는 방식

**불명확한 것**: 타깃의 연령·성별·직업 같은 구체적 페르소나는 코드에서 읽히지 않는다. 재테크·운동·반려동물이라는 조합과 복권·운세 콘텐츠가 성인 일반을 향한다는 정도만 말할 수 있고, 그 이상은 근거가 없다. 수익 모델(광고·결제·후원) 코드도 전무하다.

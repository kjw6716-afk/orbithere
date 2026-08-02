# Orbit 인수인계 패키지

> **이 폴더는 사이트가 아니라 문서입니다.** `_`로 시작하므로 GitHub Pages(Jekyll)가
> 빌드에서 제외합니다 — `orbithere.com`에서는 열리지 않습니다. `_archive/`와 같은 방식입니다.

| 파일 | 무엇 |
|---|---|
| `README.md` (이 문서) | **먼저 읽는 것.** 무슨 사이트인지, 코드가 어떻게 생겼는지, 인계받고 뭘 해야 하는지 |
| `orbit-source-snapshot.md` | 사이트를 이루는 **전체 소스 코드 한 파일 묶음**. 레포 접근 없이 코드만 넘길 때 이 파일 하나면 됩니다 |
| `make-snapshot.sh` | 위 스냅샷 생성기. `bash _handover/make-snapshot.sh` 로 다시 만듭니다 |

기준 커밋 `d59dd07` (2026-08-02). 코드가 바뀌면 이 문서도 같이 손봐야 합니다 —
스냅샷은 레포의 사본이지 원본이 아닙니다. **원본은 언제나 레포 루트의 실제 파일입니다.**
(파일을 새로 추가했다면 `make-snapshot.sh` 위쪽의 `FILES` 목록에도 한 줄 넣어야 스냅샷에 들어갑니다.)

---

## 0. 30초 요약

**orbithere.com — 밤하늘을 직접 보러 다니는 사람들을 위한 한국어 커뮤니티.**

기둥이 두 개입니다.

1. **밤하늘 달력** (`sky.html`) — 유성우·일식·월식·슈퍼문이 언제인지, 그날 달이 얼마나 밝아서
   보기 좋은지를 알려주는 정보 페이지. 검색 유입을 받는 자리이고, 하단 CTA로 커뮤니티에 밀어 넣습니다.
2. **글 남기기** (`lounge.html`) — 관측 후기 · 장비 · 실시간 하늘 · 질문 네 채널짜리 익명 게시판.
   실제 커뮤니티는 이 화면 하나뿐입니다.

기술적으로는 **프레임워크 없는 순수 정적 사이트 + Supabase**입니다. 빌드 스텝도, 서버 코드도,
`node_modules`도 없습니다. GitHub Pages가 레포 루트를 그대로 서빙하므로 **push가 곧 배포**입니다.

**로그인이 없습니다.** 닉네임과 기기 식별자를 브라우저 localStorage에 두는 게 전부고,
"내 글인지"는 닉네임이 아니라 기기 ID로 판단합니다. 로그인은 운영자 한 명을 위한
`admin.html`(관제실)에만 있습니다.

> **2026-08-02 방향 전환** — 원래는 생활밀착형 잡담 커뮤니티(자유·재테크·운동·반려동물 채널,
> 로또 추첨기, 오늘의 운세)였습니다. 밤하늘 관측 하나로 좁히면서 추첨기·운세는 `_archive/`로
> 내리고 채널을 통째로 갈아끼웠습니다. 이 문서와 코드는 **전환 이후 상태**입니다.

---

## 1. 화면 흐름

```
index.html  (랜딩 — 유성우 애니메이션, 아무 데나 클릭)
    │  700ms 뒤 이동
    ▼
main.html   (앱 셸: 사이드바 + 상단바)
    ├── [🔭 밤하늘 달력]  ── iframe ──▶ sky.html?embed=1     ← 기본 화면
    ├── [💬 글 남기기]    ── iframe ──▶ lounge.html?embed=1
    └── 상단 칩 🦦        ──▶ 궤도 진입(닉네임) 대화상자

sky.html / lounge.html 은 단독 URL로도 열립니다 (검색 유입·공유용).
`?embed=1`이 붙으면 <html>에 .embed 클래스가 붙어 상단바·푸터·중복 제목을 접습니다.

admin.html  (관제실 — 링크 없음. 주소를 직접 쳐야 합니다. noindex + robots Disallow)
terms.html / privacy.html / 404.html
```

`main.html`과 iframe 사이의 대화는 `postMessage` 두 가지뿐입니다.

| 방향 | 메시지 | 하는 일 |
|---|---|---|
| lounge → main | `{orbit:'join'}` | 닉네임 대화상자를 열어달라 (`lounge.html:491`) |
| sky → main | `{orbit:'skyHeight', height}` | 내 콘텐츠 높이가 이만큼이니 iframe을 늘려달라 (`sky.html:773-789`) |

받는 쪽은 `main.html:466-480`. 둘 다 `ev.origin` 검사를 합니다.
단독 페이지에서 닉네임이 필요하면 `main.html#join`으로 넘어가고, 대화상자를 닫을 때
해시를 `#sky`로 되돌려 새로고침 때 다시 열리지 않게 합니다.

---

## 2. 아키텍처 한 장

```
        브라우저 (사용자)
             │
   ┌─────────┴──────────────────────────────┐
   │                                        │
   ▼ 정적 파일                               ▼ 데이터
GitHub Pages                          Supabase (PostgREST + Auth)
(레포 루트 그대로,                            │
 CNAME으로 orbithere.com)                    ▼
                                      PostgreSQL
                                      · RLS 정책 = 권한의 유일한 근거
                                      · security definer 함수(RPC)
                                      · insert 트리거 = 도배 방지

서버 코드 0줄. Edge Function 없음. 빌드 없음.
외부 의존은 딱 둘: Pretendard 폰트(jsDelivr), @supabase/supabase-js@2(CDN).
```

**중요한 원칙 하나.** 클라이언트의 `isAdmin` 같은 변수는 **버튼을 보여줄지 말지**만 정합니다.
실제로 삭제가 되는지는 전적으로 서버 RLS가 판단합니다. 브라우저 콘솔에서 `isAdmin = true`를
넣어도 남의 글은 지워지지 않습니다 (`lounge.html:483-486`의 주석에 같은 내용이 있습니다).

---

## 3. 파일 지도 · 읽는 순서

처음 보는 사람이라면 **③ → ④ 순서**로 읽으면 사이트가 통째로 이해됩니다.

| 순서 | 파일 | 줄 | 역할 | 먼저 볼 곳 |
|---|---|---|---|---|
| ① | `index.html` | 325 | 랜딩. CSS 애니메이션만, 로직 없음 | 맨 아래 `<script>` (클릭 → 700ms → main) |
| ② | `main.html` | 598 | 앱 셸. 탭 전환 · iframe 지연 로딩 · 닉네임 대화상자 | `switchPanel()` 426, 진입 대화상자 482–595 |
| ③ | `lounge.html` | 1141 | **커뮤니티 전체.** 글·답·리액션·신고·삭제 | `ORBIT_LIST` 460, `loadPosts()` 602, `renderPosts()` 676 |
| ④ | `sky.html` | 792 | 밤하늘 달력. 달 위상 계산 + 이벤트 표 + SEO 본문 | `moonInfo()` 365, `EVENTS` 451–585 |
| ⑤ | `admin.html` | 560 | 관제실. 로그인 → 신고함 처리 · 업데이트 기록 | `loadReports()` 427, `showSession()` 490 |
| ⑥ | `orbit.css` | 173 | 공통: 색 변수 · 상단바 · 푸터 · 모션 감속 | `:root` 변수 18–24 |
| ⑦ | `effects.js` | 229 | 클릭하면 별이 튀는 canvas 파티클 | `burst()` 102 |
| — | `terms.html` `privacy.html` `404.html` | 155 / 177 / 88 | 약관·방침(전문 작성됨)·커스텀 404 | — |
| — | `supabase/*.sql` | 9개 | 스키마 + 마이그레이션. **번호 순서대로 실행** | `schema.sql` → `002` → … → `008` |

레포에 CSS/JS 파일이 `orbit.css`와 `effects.js` 둘뿐인 이유: **나머지는 전부 각 HTML 안에
인라인**입니다. 페이지 하나가 곧 기능 하나이므로 그 페이지만 열면 전부 보이게 한 구조입니다.

### 코드 컨벤션

- ES5 스타일 IIFE가 기본, 네트워크 호출만 `async/await`.
- 주석은 "왜 이렇게 했는지"를 적습니다. **TODO/FIXME는 레포 전체에 0건**입니다.
- 사용자에게 보이는 문자열은 전부 한국어이고, 우주 은유로 통일돼 있습니다(아래 사전 참고).

### 은유 사전 — 코드와 UI에서 쓰는 말

| UI/코드 | 실제 의미 |
|---|---|
| 궤적 (trace) | 글 / 게시물 (`posts`) |
| 궤도 (orbit) | 채널 / 게시판 (`posts.orbit`) |
| 궤도 진입 | 가입 = 닉네임 정하기 (계정은 없음) |
| 답 | 댓글 (`comments`) |
| 교차 | 이모지 리액션 (`reactions`) |
| 광장 | 글 남기기 화면 = `lounge.html` (코드·주석에 남은 옛 이름) |
| 관제실 | 관리자 페이지 = `admin.html` |
| 젤리별 | 마스코트 격인 별 SVG (랜딩·푸터·클릭 파티클) |

---

## 4. 데이터 모델과 권한

### 테이블

| 테이블 | 컬럼 요지 | 제약 |
|---|---|---|
| `posts` | id, nick, orbit, text, author_device, created_at | nick 2~12자 · text 1~500자 · orbit은 check로 잠금 · author_device 8~64 NOT NULL |
| `comments` | id, post_id→posts(cascade), nick, text, author_device, created_at | text 1~300자 |
| `reactions` | id, post_id→posts(cascade), emoji, device_id, created_at | emoji ∈ `⭐🔥😂🥰👏❤️` · **unique(post_id, emoji, device_id)** |
| `reports` | id, target_type, target_id, reason, detail, reporter_device, handled | reason ∈ spam/abuse/adult/privacy/etc · **unique(target_type, target_id, reporter_device)** |
| `admins` | user_id→auth.users(cascade), note | **RLS 켜고 정책 0개** = REST로 아무도 못 읽음 |

`posts.orbit`의 현재 허용값: `report` `gear` `live` `ask` (현행) + `free` `money` `dawn` `pet`
(옛 글 보존용). 옛 채널 글은 `lounge.html`의 `orbitInfo()` 폴백을 타서 🛰️ 칩으로 보입니다.

### 누가 무엇을 지울 수 있나 — 이 표가 권한 모델 전부입니다

| 대상 | 일반 사용자 | 관리자 | 어떻게 |
|---|---|---|---|
| 내 글 | ✅ 작성 기기가 같을 때만 | ✅ | 사용자 = `delete_post` RPC / 관리자 = REST delete (RLS `is_admin()`) |
| 남의 글 | ❌ | ✅ | `posts`에는 사용자용 delete 정책 자체가 없음 |
| 내 답 | ✅ 기기 일치 | ✅ | `delete_comment` RPC |
| 내 리액션 | ✅ 기기 일치 | ✅ | `delete_reaction` RPC |
| 신고 내역 읽기 | ❌ | ✅ | `report_queue()` — 함수 안에서 `is_admin()` 직접 검사 |

**RPC 목록** — `delete_post` `delete_comment` `delete_reaction` `reaction_summary`
`reaction_counts`(현재 호출처 없음) `is_admin` `report_queue` `resolve_report`

**트리거(도배 방지)** — 분/시간 기준 insert 제한: posts 3·20 / comments 5·50 / reports 5·30.
예외 문구(`orbit_rate_limit` 등)를 클라이언트 `errHint()`가 읽어 안내를 띄우므로
**SQL의 예외 이름을 바꾸면 `lounge.html:654-672`도 같이 고쳐야 합니다.**

**localStorage** — `orbit_nickname` `orbit_joindate` `orbit_jointime` `orbit_device_id`
(레거시 `orbit_zodiac` `orbit_animal`은 운세 페이지를 내리며 더 이상 읽고 쓰지 않음)

### 글 한 번 쓰면 벌어지는 일

```
[궤적 남기기] 클릭
  → sb.from('posts').insert({nick, orbit, text, author_device})   lounge.html:578
      → RLS posts_insert (누구나 허용)
      → check 제약 (닉 2~12 / 글 1~500 / orbit 허용값)   위반 시 23514
      → posts_rate_limit 트리거                          위반 시 orbit_rate_limit
  → 성공하면 loadPosts({quiet:true})                      lounge.html:602
      → posts 최신 50개
      → rpc('reaction_summary', {post_ids, device})       ← device_id를 밖으로 안 내보냄
      → comments 일괄 조회 (in post_ids, 최대 500)
  → renderPosts()                                         lounge.html:676
```

실시간 구독도, 페이지네이션도 없습니다. **최신 50개가 전부**입니다.

---

## 5. 인계받고 처음 하는 일

### 로컬에서 띄우기

```bash
git clone <repo> && cd orbithere
python3 -m http.server 8000     # 또는 npx serve .
open http://localhost:8000
```

`file://`로 열면 안 됩니다 — iframe의 `postMessage` origin이 `null`이 되어 탭 연동이 깨집니다.
빌드도 설치도 없고, 로컬에서도 **운영 Supabase에 그대로 붙습니다**(publishable 키가 소스에
박혀 있음). 즉 **로컬에서 쓴 글이 진짜 사이트에 올라갑니다.** 테스트하려면 아래 "Supabase
프로젝트 교체"로 별도 프로젝트를 만드세요.

### 코드가 아니라 사람에게서 받아야 하는 것

코드만 봐서는 절대 알 수 없는 것들입니다. 인계 시 반드시 확인하세요.

- [ ] **Supabase 프로젝트 소유권** — 대시보드 계정. 현재 프로젝트: `unwxpuvfqyjhgrcrmuhu`
- [ ] **관리자 계정** — `admin.html` 로그인용 이메일/비밀번호, 그리고 `admins` 테이블에 든 UID.
      운영 UID는 **의도적으로 레포에 없습니다** (`migration_005_admin.sql` 하단이 주석 처리된 이유)
- [ ] **어느 마이그레이션까지 실제로 적용됐는지** — 특히 `migration_008`. 안 돌았으면 글 작성이 23514로 실패
- [ ] **GitHub Pages 설정** — 어느 브랜치를 서빙하는지. 워크플로 파일이 없어 코드로는 알 수 없음
- [ ] **도메인** — `orbithere.com` 등록기관 계정과 DNS 설정
- [ ] GitHub 레포 소유권

---

## 6. 자주 하는 변경 레시피

### 채널(궤도) 추가·변경 — **두 곳을 반드시 같이 고칩니다**

1. `lounge.html`의 `ORBIT_LIST`(460행)에 `{id, icon, label, desc}` 한 줄 추가
2. DB의 `posts_orbit_check` 제약에 그 `id` 추가 — `migration_008_sky_orbits.sql`을 본떠
   새 마이그레이션 파일을 만들어 실행

②를 빼먹으면 새 채널에 글을 쓸 때 **23514**로 막힙니다.
**옛 id를 재사용하지 마세요** — 예전 글이 엉뚱한 이름표를 달게 됩니다(`migration_008` 주석 참고).

### 천문 이벤트 갱신 — **가장 시급한 정기 작업**

`sky.html:451-585`의 `EVENTS` 배열은 전부 하드코딩이고, **마지막 항목이 2027-08-02**입니다.
그 날짜가 지나면 카운트다운이 "예정된 현상이 없습니다"로 굳고 타임라인이 빈 상태가 됩니다.
첫 화면이라 체감이 큽니다. 한국천문연구원(KASI)·국제유성기구(IMO) 자료를 보고 항목을 이어 붙이세요.

필드 의미: `watch`는 **실제로 하늘을 봐야 하는 시각(KST)** — D-day와 정렬의 기준입니다.
`peak`(극대)와 다를 수 있습니다. `kr`은 국내 관측 가능 여부. 달 밝기·월령·관측 조건 등급은
하드코딩이 아니라 `moonInfo()`가 Meeus 알고리즘으로 계산하므로 **몇 년 뒤 날짜도 그대로 맞습니다.**

### 관리자 추가

Supabase → Authentication → Users → Add user (**Auto Confirm User 켤 것**, 안 켜면
`Email not confirmed`로 로그인 실패) → UID 복사 →
`insert into public.admins (user_id, note) values ('<UID>', '운영자');`

### Supabase 프로젝트 교체

URL/키가 **2곳에 복붙**돼 있습니다: `lounge.html:447-448`, `admin.html:384-385`. 둘 다 고치세요.
새 프로젝트라면 `supabase/`의 SQL을 **`schema.sql` → `002` → `003` → … → `008` 순서대로**
실행해야 합니다. `schema.sql`만 돌리면 orbit 허용값이 옛 값(`free/money/dawn`)에 머물러
글 작성이 전부 실패합니다.

### 배포

`main` 브랜치에 push하면 GitHub Pages가 그대로 서빙합니다. 별도 빌드·워크플로 없음.

---

## 7. 알려진 결함과 한계 — 인계 시 반드시 알아야 할 것

**실제 결함**

1. `sky.html`의 이벤트가 **2027-08-02에 끝납니다.** 이후 첫 화면이 빈 상태로 굳습니다 (위 레시피 참고)
2. `schema.sql`의 orbit check는 아직 `('free','money','dawn')`뿐입니다. 새 프로젝트에
   `schema.sql`만 실행하면 **글 작성이 23514로 실패**합니다 — 008까지 순서대로 실행 필요
3. 마이그레이션 순서 의존: `003` 적용 후 `schema.sql`을 다시 돌리면 마지막 환영 글 insert가
   실패합니다(`author_device` 없음)

**설계상 한계** (코드 주석에 이미 명시된 것들)

- 익명 기기 ID 기반이라 **localStorage를 지우면 새 기기**가 됩니다 → rate limit과 중복 신고
  방지를 우회할 수 있습니다. IP 제한이 필요해지면 쓰기를 Edge Function 뒤로 옮기는 게 다음 단계
- **닉네임 선점 없음** — 같은 닉을 여러 명이 쓸 수 있습니다. 그래서 '나' 배지와 삭제 권한을
  닉이 아닌 `author_device`로 판단합니다
- 광장은 **최신 50개 고정**. 페이지네이션·무한스크롤·실시간 구독 없음
- Supabase URL/키가 2개 파일에 복붙 → 프로젝트 교체 시 2곳을 고쳐야 함
- Supabase가 일시정지되면 광장 전체가 "서버에 연결할 수 없어요"로 죽습니다
- **`_archive/` 노출 위험**: 밑줄 디렉터리는 Jekyll이 빌드에서 빼므로 지금은 공개되지 않습니다.
  다만 `.nojekyll`을 추가하거나 Pages 배포를 GitHub Actions로 바꾸면 **그대로 공개됩니다.**
  안전망으로 noindex meta와 robots Disallow를 넣어 두었습니다 (이 `_handover/`도 같은 조건입니다)

**없는 기능** — 일반 사용자 로그인, 프로필, 레벨/XP, 매칭·팔로우·DM, 검색, 알림, 수익 모델.
전부 UI도 테이블도 없습니다. "나중에 붙일 자리"가 아니라 **애초에 만든 적이 없습니다.**

**코드만으로 확인 불가** — 라이브 사이트 실제 동작, Supabase의 실제 마이그레이션 적용 상태,
GitHub Pages 설정값.

---

## 8. 이 사이트는 누구를 위한 것인가

코드에서 읽히는 사실만 적습니다.

- **한국어 사용자 전용** — 모든 페이지 `lang="ko"`, 다국어 처리 전무, KST 기준 일정, 🇰🇷 국내 관측 필터
- **밤하늘을 직접 보러 다니는 사람들** — 채널 4개가 후기 / 장비 / 실시간 / 질문으로,
  관측이라는 단일 활동의 단계별 구성입니다
- **입문자를 배제하지 않음** — '질문' 궤도 설명이 "뭐부터 봐야 할지, 저건 뭔지 — 무엇이든 물어보는 궤도"
- **검색 유입 → 커뮤니티 전환 구조** — 달력에 JSON-LD와 FAQ 본문을 붙이고 하단 CTA로 후기 궤도에 연결
- **진입 장벽을 극단적으로 낮춘 익명 서비스** — 가입·로그인·이메일 없이 닉네임 두 글자면 글을 씁니다
- **혼자 운영하는 소규모 서비스** — 문의 창구가 별도 이메일이 아니라 "글 남기기에 남겨주세요",
  관리자 등록이 `admins` 테이블에 UID 직접 삽입

더 자세한 현황(파일별 상태·기능별 완성도·근거 줄 번호)은 레포 루트의 **`PROJECT_STATUS.md`**에 있습니다.
이 문서가 "무엇이고 어떻게 손대는가"라면, 그쪽은 "지금 어디까지 되어 있는가"입니다.

# 🪐 Orbit — 궤도에서 너를 만나다

밤하늘을 같이 보는 사람들이 모이는 커뮤니티, [orbithere.com](https://orbithere.com)

## 페이지 구성

| 페이지 | 설명 |
|---|---|
| `index.html` | 랜딩 — 유성우와 젤리별이 도는 입구 |
| `main.html` | 커뮤니티 홈 — 밤하늘 달력 · 글 남기기 두 탭, 궤도 진입(닉네임) 대화상자 |
| `sky.html` | 밤하늘 달력 — 유성우 · 일식 · 월식 · 슈퍼문 일정, 달 위상 계산 |
| `lounge.html` | 글 남기기 — 궤도(채널)별 글·답·리액션·신고 (Supabase) |
| `admin.html` | 관제실 — 운영자 로그인, 신고함, 업데이트 기록 |
| `terms.html` / `privacy.html` | 이용약관 · 개인정보처리방침 |
| `404.html` | 커스텀 404 |

공통 스크립트는 `orbit.css` · `effects.js`(클릭 파티클) · `visits.js`(방문 집계) 세 개입니다.
`visits.js`는 하루 한 번 방문 수만 세고 **화면에는 아무것도 그리지 않습니다** — 그 숫자는
관제실(`admin.html`)에서만 봅니다.

궤도(채널)는 **관측 후기 · 장비 · 실시간 하늘 · 질문** 네 개이고, 첫 진입 기본 채널은
**관측 후기**입니다. 나머지 셋은 `minor`로 표시해 탭을 한 톤 낮춰 둡니다.
채널을 늘리거나 바꿀 때는 `lounge.html`의 `ORBIT_LIST`와 DB의 `posts_orbit_check` 제약을
**같이** 고쳐야 합니다 (`supabase/migration_008_sky_orbits.sql` 참고).

`_archive/`에는 사이트에서 내렸지만 지우지 않은 페이지가 있습니다 — `_archive/README.md` 참고.

## 기술

- 프레임워크 없는 순수 HTML/CSS/JS 정적 사이트 (빌드 스텝 없음)
- 호스팅: GitHub Pages · 데이터베이스: Supabase · 폰트: Pretendard
- 로그인 없음. 닉네임과 기기 식별자를 localStorage에 두고, 권한 판정은 전부 Postgres RLS가 합니다

## Supabase 설정

`supabase/` 안의 SQL을 **번호 순서대로**(`schema.sql` → `002` → … → `010`) SQL Editor에서
실행하세요. `schema.sql`만 실행하면 채널 제약이 옛 값에 머물러 글 작성이 23514로 막히고,
`010`은 `009`가 만든 함수를 바꾸므로 순서를 건너뛰면 실패합니다.

새 기능이 localStorage 키를 추가하거나 서버에 새 값을 보내면
**`privacy.html`과 `PROJECT_STATUS.md`를 같은 커밋에서 함께 고칩니다.**

---

## ⚖️ 저작권 안내 (Copyright Notice)

**© 2026 Orbit (orbithere.com). All rights reserved.**

이 저장소는 GitHub Pages 배포를 위해 공개되어 있을 뿐, **오픈소스가 아닙니다.**
별도의 라이선스를 부여하지 않으며, 저작권법에 따라 모든 권리를 보유합니다.

- 코드·디자인·문구·캐릭터(젤리별 포함)의 **무단 복제, 수정, 재배포, 상업적 이용을 금지**합니다.
- 학습 목적의 열람은 환영하지만, 이 사이트의 전체 또는 일부를 복제한 사이트를 만드는 것은 저작권 침해입니다.

This repository is public only for GitHub Pages deployment. **No license is granted.**
Unauthorized copying, modification, redistribution, or commercial use of the code,
design, content, or characters is prohibited.

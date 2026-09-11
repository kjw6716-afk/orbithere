# 🪐 Orbit — 궤도에서 너를 만나다

밤하늘을 함께 보는 사람들을 위한 [orbithere.com](https://orbithere.com).

- **오늘 밤 행성**: 관측지 8곳의 행성 방향·고도·관측 시간, 움직이는 하늘 지도
- **밤하늘 달력**: 국내 관측 여부와 달 밝기를 함께 보여주는 천문 일정
- **글 남기기**: 관측 후기 · 장비 · 실시간 하늘 · 질문 · 자유게시판

순수 HTML/CSS/JS 정적 사이트입니다. GitHub Pages가 저장소 루트를 배포하며,
Supabase가 게시물과 작성자 인증을 담당합니다. 사이트 자체에는 빌드 단계가 없습니다.

## 운영 전환 — 2026-09 보안 업데이트

**GitHub 병합만으로 Supabase 데이터베이스 설정은 변경되지 않습니다.**

1. 기존 Supabase 프로젝트가 일시정지되었다면 대시보드에서 재개합니다.
2. SQL Editor에서 `supabase/migration_011_authenticated_ownership.sql`을 실행합니다.
   기존 프로젝트는 010까지 적용되어 있어야 합니다. 새 프로젝트는 `schema.sql` → 002…011 순서대로 실행합니다.
3. Authentication → Sign In / Providers에서 **Allow new users to sign up**과 **Allow anonymous sign-ins**를 활성화합니다. 신규 가입 전체가 차단되어 있으면 익명 인증도 발급되지 않습니다. 사용자 화면에 이메일·비밀번호 입력은 생기지 않습니다.
4. 새 글·댓글 작성, 본인 삭제, 다른 브라우저의 삭제 차단, 관리자 삭제를 점검합니다.

현재 `orbithere.com` 운영 프로젝트에는 2026-09-11에 SQL 011과 위 인증 설정을 적용했습니다.
PR #42의 검사·Pages 배포 성공, 기존 콘텐츠 보존, 공개 조회 성공, 기기 식별값 조회 및 미인증 삭제 RPC 차단을 확인했습니다.
새 프로젝트를 만들거나 DB를 복원할 때는 위 절차를 다시 확인하세요.

이번 변경은 공개되어 있던 기기 ID를 삭제 권한에 쓰던 경로를 없앱니다.
새 글의 소유권은 서버가 발급한 익명 인증 계정으로 확인합니다.
기존 글·댓글은 보존하지만 공개 ID를 이용해 소유권을 이전하지 않습니다.
**이전 방식의 게시물은 관리자에게 삭제를 요청해야 합니다.**

서버 업데이트 전에는 새 화면도 기존 글을 읽을 수 있습니다. 쓰기·리액션·삭제·신고는
보안 전환 확인 후에만 허용합니다. 기존 서버의 취약한 RPC는 SQL 011 적용 전까지
남아 있으므로, 화면 배포를 데이터베이스 보안 조치의 대체로 생각하면 안 됩니다.

공개 서버 주소와 publishable 키는 `orbit-config.js` 한 곳에서 관리합니다.
`service_role`, secret 키, 데이터베이스 비밀번호를 저장소에 넣지 마세요.

## 검사

```sh
npm ci
npx playwright install chromium
npm test
```

| 검사 | 범위 |
|---|---|
| `test:astronomy` | 태양·달·행성 계산, 일출·일몰 교차검증 |
| `test:links` | 내부 링크·sitemap·메타데이터·브라우저 저장소 문서화 |
| `test:security` | 실제 SQL 마이그레이션과 PostgreSQL RLS를 PGlite에서 실행; 소유권 위조·삭제·도배 제한 검사 |
| `test:render` | 지도 이름표·모바일 크기·키보드·임베드·빈 일정 |
| `test:community` | 실제 SDK + 모의 서버로 작성·재시도·오류 복구·채널 경쟁·D-day·탭 히스토리·대화상자 검사 |

검사는 운영 DB에 게시물을 만들지 않습니다. GitHub Actions는 main push와 PR에서 같은 검사를 실행합니다.
Pages의 기존 배포 설정은 유지하므로, 직접 main에 푸시하면 검사 완료 전에도 배포될 수 있습니다.
PR 검사가 통과한 뒤 병합하는 흐름을 사용하세요.

## 유지보수

- 페이지·데이터·인증 변경 시 `PROJECT_STATUS.md`를 함께 갱신합니다.
- 브라우저 저장값이나 서버 전송값이 바뀌면 `privacy.html`도 함께 갱신합니다.
- 천문 일정 마지막 항목은 2027-08-02입니다. 이후 일정은 근거 자료를 확인해 추가해야 합니다.
- `_archive/`는 이전 기능 보관용입니다. `.nojekyll`을 추가하거나 배포 방식을 변경할 때 공개 범위를 확인하세요.

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

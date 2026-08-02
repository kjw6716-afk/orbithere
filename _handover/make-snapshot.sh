#!/usr/bin/env bash
# Orbit 전체 소스 스냅샷 생성기 — 레포 어디서 실행해도 _handover/orbit-source-snapshot.md를 다시 만든다.
# 코드를 고친 뒤 스냅샷을 갱신하려면:  bash _handover/make-snapshot.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # 레포 루트
OUT=_handover/orbit-source-snapshot.md
COMMIT=$(git rev-parse --short HEAD)
DATE=$(date -u +%Y-%m-%d)

# 파일 | 언어 | 한 줄 설명
FILES=(
"index.html|html|랜딩. CSS 애니메이션(유성우 20개 + 공전하는 젤리별)만 있고 로직은 맨 아래 클릭 핸들러 하나. 아무 데나 클릭하면 700ms 뒤 main.html로 넘어간다. 하단 바로가기는 검색엔진이 따라갈 실제 링크라 전환에서 제외한다."
"main.html|html|앱 셸. 사이드바 2탭(밤하늘 달력 / 글 남기기)이 각각 sky.html·lounge.html을 ?embed=1 iframe으로 띄운다. 처음 열 때만 src를 채우는 지연 로딩. 상단 칩이 궤도 진입(닉네임) 대화상자의 유일한 입구다. iframe에서 오는 postMessage(join / skyHeight)를 여기서 받는다."
"sky.html|html|밤하늘 달력 — 첫 화면이자 검색 유입 창구. 위쪽은 다음 현상 카운트다운·오늘의 달·필터·타임라인, 아래쪽은 SEO 본문과 FAQ. 달의 위상·밝기·월령은 Meeus 알고리즘으로 직접 계산하고(moonInfo), 이벤트 일정 14건은 EVENTS 배열에 하드코딩돼 있다(2026-08 ~ 2027-08). head에 JSON-LD 두 개(WebApplication·FAQPage)."
"lounge.html|html|커뮤니티 전체가 이 파일 하나다. 채널 탭·글쓰기·목록·이모지 리액션·댓글·신고·삭제. Supabase URL/키가 여기(447-448)와 admin.html 두 곳에 있다. ORBIT_LIST가 채널 단일 설정이고, DB의 posts_orbit_check 제약과 짝을 이룬다."
"admin.html|html|관제실. Supabase Auth 로그인 후 is_admin()으로 권한을 확인하고, 통과하면 신고함(report_queue / resolve_report)과 업데이트 기록(v0.1~v1.5 정적 타임라인)을 연다. 사이트 어디에도 링크가 없고 noindex + robots Disallow."
"terms.html|html|이용약관 전문. 제6조가 밤하늘 달력 정보의 정확성 면책(방향 전환 때 Lucky Orbit 면책에서 교체됨)."
"privacy.html|html|개인정보처리방침 전문. 기기 식별자(author_device / device_id / reporter_device) 수집을 수집 표·이용 목적·보관 파기·localStorage 목록에 명시한다."
"404.html|html|커스텀 404."
"orbit.css|css|공통 스타일. 색 변수(:root) · 스크롤바 · 배경 글로우 · 상단바 · 푸터 · 콘텐츠 페이지 공통(hero/seo-content/notice/cta-lounge) · prefers-reduced-motion 전역 처리. 각 페이지 <style>이 이 파일보다 뒤에 오므로 페이지 쪽이 이긴다."
"effects.js|js|클릭하면 별이 튀는 canvas 파티클 엔진(rAF). visualViewport 기준으로 그려서 핀치 확대·키보드에도 잔상이 남지 않는다. 동작 줄이기 설정이면 아예 실행하지 않고, 입력창 탭과 확대 상태에서는 건너뛴다."
"supabase/schema.sql|sql|최초 스키마 — posts · reactions · RLS · delete_post · 환영 글 seed. 주의: 여기 orbit check는 아직 옛 값(free/money/dawn)이라 이것만 실행하면 글 작성이 23514로 실패한다."
"supabase/migration_002_delete.sql|sql|author_device 컬럼과 delete_post RPC(기기 일치 시에만 삭제)."
"supabase/migration_003_rate_limit.sql|sql|글 도배 방지 — author_device NOT NULL(NOT VALID) + 1분 3개 / 1시간 20개 트리거. 예외 이름 orbit_rate_limit을 클라이언트가 읽는다."
"supabase/migration_004_comments.sql|sql|댓글 테이블 · delete_comment RPC · 1분 5개 / 1시간 50개 트리거. 글보다 느슨하고 300자 제한."
"supabase/migration_005_admin.sql|sql|관리자 체계의 핵심. admins 테이블(RLS 켜고 정책 0개) · is_admin() · 관리자 delete 정책 · delete_reaction RPC · reaction_summary(device_id 비노출) · reaction_counts. 운영 UID는 의도적으로 주석 처리돼 레포에 없다."
"supabase/migration_006_pet_orbit.sql|sql|orbit 제약에 'pet' 추가. 채널을 늘릴 때 제약을 어떻게 다시 만드는지 보여주는 본보기."
"supabase/migration_007_reports.sql|sql|신고 — reports 테이블(대상·기기 유니크) · 관리자 전용 read/update 정책 · 도배 방지 트리거 · report_queue()(신고와 신고당한 내용을 함께) · resolve_report()(대상 삭제 여부를 받아 같은 대상의 신고를 일괄 처리)."
"supabase/migration_008_sky_orbits.sql|sql|방향 전환 마이그레이션. orbit 제약에 report/gear/live/ask 추가. 옛 값 4개도 함께 허용해야 기존 행이 ALTER를 실패시키지 않는다. 하단에 옛 글 정리용 3단계 쿼리가 주석으로 있다. 미적용 시 글 작성 불가."
"supabase/migrate_emoji_2026-07.sql|sql|리액션 이모지 이전 — 구형 기기에서 깨지던 유니코드 14 이모지 교체(🥹→🥰, 🫶→❤️)."
"robots.txt|text|admin.html과 _archive/ 차단, sitemap 위치."
"sitemap.xml|xml|6개 URL. admin.html과 _archive/는 넣지 않는다."
"site.webmanifest|json|PWA 매니페스트(standalone, 아이콘 4종)."
"CNAME|text|GitHub Pages 커스텀 도메인."
"favicon.svg|xml|파비콘 — 젤리별 SVG."
"README.md|markdown|레포 README. 페이지 구성 · 기술 · Supabase 설정 · 저작권 안내(오픈소스 아님)."
"_archive/README.md|markdown|내린 페이지 보관 안내 — 왜 밑줄 디렉터리인지, 되살리는 방법, 되살릴 때 다시 연결할 곳 목록."
)

{
cat <<HEADER
# Orbit — 전체 소스 스냅샷

**orbithere.com · 밤하늘 관측 커뮤니티**
기준 커밋 \`$COMMIT\` · 생성일 $DATE

이 파일 하나에 사이트를 이루는 **모든 소스 코드**가 들어 있습니다. 레포 접근 없이
코드만 넘겨야 할 때 이것만 전달하면 됩니다. 각 파일 앞에 그 파일이 무엇인지 한 문단씩 붙였습니다.

> 이건 **사본이자 스냅샷**입니다. 원본은 레포 루트의 실제 파일이고, 코드가 바뀌면 이 파일은 낡습니다.
> 사이트가 무엇이고 어떻게 손대는지는 같은 폴더의 \`README.md\`를 먼저 읽으세요.

**포함하지 않은 것**
- 바이너리: \`images/og.png\` \`images/otter.png\` \`favicon.ico\` \`favicon-32.png\` \`icon-192.png\` \`icon-512.png\` \`apple-touch-icon*.png\`
- \`_archive/lucky.html\` \`_archive/fortune.html\` — 2026-08-02에 사이트에서 내린 로또 추첨기·운세 페이지.
  현행 사이트의 일부가 아니라 제외했습니다(레포에는 그대로 있고, 되살리는 방법은 \`_archive/README.md\`에).
- \`PROJECT_STATUS.md\`, \`_handover/README.md\` — 코드가 아니라 문서라서 제외.

---

## 목차

HEADER

for entry in "${FILES[@]}"; do
  f="${entry%%|*}"
  # GitHub 앵커 규칙: 소문자 + 마침표·슬래시 제거 (밑줄은 유지)
  anchor=$(echo "$f" | tr '[:upper:]' '[:lower:]' | tr -d './')
  echo "- [\`$f\`](#$anchor)"
done

echo
echo "---"
echo

for entry in "${FILES[@]}"; do
  f="${entry%%|*}"
  rest="${entry#*|}"
  lang="${rest%%|*}"
  desc="${rest#*|}"
  lines=$(awk 'END{print NR}' "$f")   # wc -l은 마지막 개행이 없는 파일을 한 줄 덜 센다
  bytes=$(wc -c < "$f")
  echo
  echo "## \`$f\`"
  echo
  echo "> $lines줄 · $bytes바이트"
  echo
  echo "$desc"
  echo
  # 4중 백틱 — 마크다운 파일 안에 3중 백틱이 있어도 울타리가 깨지지 않게
  echo '````'"$lang"
  cat "$f"
  # 마지막 줄에 개행이 없는 파일(CNAME, favicon.svg)은 닫는 울타리가 붙어버린다
  if [ -n "$(tail -c 1 "$f")" ]; then echo; fi
  echo '````'
  echo
done

cat <<'FOOTER'

---

## 저작권

© 2026 Orbit (orbithere.com). All rights reserved.
이 코드는 오픈소스가 아닙니다. GitHub Pages 배포를 위해 레포가 공개되어 있을 뿐이며
별도의 라이선스를 부여하지 않습니다. 자세한 내용은 위 `README.md`의 저작권 안내를 보세요.
FOOTER
} > "$OUT"

wc -l "$OUT"; wc -c "$OUT"

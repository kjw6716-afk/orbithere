# 성운 배경과 수달 관측 안내

사용자가 승인한 첫 화면 목업을 바탕으로 만든 정지 배경과, 별지도 입문 안내용 수달입니다.
기존 GitHub Pages와 페이지 주소를 유지합니다. 브리핑·문의·뉴스·글 발행 예약은 변경하지 않습니다.

## 화면과 자산

- 홈에서는 화면 전체에 성운을 표시합니다. 자유게시판은 같은 자산을 짧은 제목 배너 안에서만 재사용합니다([게시판 디자인](lounge-design.md)). 홈의 별도 고정 이미지 레이어는 동작 줄이기 설정에서도 남고 유성만 사라집니다. 일반 설정에서는 `landing-meteors.js`가 20~45초의 무작위 대기 후 상단의 무작위 위치에서 유성 하나를 1.6~2.4초 동안 표시합니다. 화면 안쪽으로 짧게 이동하며, 이전 유성이 끝나야 다음 대기를 시작합니다. 비활성 탭·동작 줄이기·페이지 이탈 시 유성과 타이머를 정리하고, 복귀하면 새 대기 시간부터 시작합니다.
- 공통 `ORBIT.` 로고는 흰색입니다. 내부 메뉴 선택과 계정 진입 버튼은 민트색으로 통일하며, 에디터 별 아이콘과 홈의 기존 강조색은 유지합니다.
- 성운 배경은 AVIF와 WebP를 네 가지 폭으로 제공하고 브라우저가 `srcset`으로 고릅니다. 마스터는 2430 × 1457이며 그보다 크게 늘리지 않습니다.

  | 폭 | AVIF | WebP |
  | --- | --- | --- |
  | 1200 × 720 | 44,448 bytes | 52,668 bytes |
  | 1600 × 959 | 69,433 bytes | 80,784 bytes |
  | 2000 × 1199 | 95,460 bytes | 109,946 bytes |
  | 2430 × 1457 | 126,096 bytes | 143,786 bytes |

  한 화면은 이 중 한 개만 내려받습니다. AVIF를 지원하지 않는 브라우저는 같은 폭의 WebP를 받고, `<picture>`를 해석하지 못하면 1600 WebP를 받습니다.
- `object-fit: cover`는 세로 화면에서 이미지를 `100vw`보다 훨씬 넓게 그립니다. 그래서 `sizes`는 세로일 때만 `170vw`를 씁니다. 이 값을 `100vw`로 되돌리면 휴대폰이 필요보다 작은 자산을 고릅니다.
- 화면 너비 600px 이하에서 `object-position: 33% center`로 왼쪽 성운이 보이도록 잘라냅니다. 이전의 모바일 전용 파일은 별도 구도가 아니라 축소본이었으므로 `srcset` 통합과 함께 제거했습니다.
- `images/otter-sky-guide.webp`: 1536 × 512, 122,894 bytes, 투명 배경의 세 자세. CSS로 각 3분의 1을 표시해 동일 이미지를 재사용합니다.
- `reading-sky.html`의 수달은 AI로 제작한 설명용 마스코트입니다. 실제 나침반 방향·각도·그래프는 HTML/SVG/JavaScript로 표시하며 이미지 속 자세를 각도 측정값으로 사용하지 않습니다.
- 연습용 목성·토성·금성 위치는 교육용 고정 예시입니다. 실제 계산이나 현재 관측 예보가 아니며, 실제 지도는 기존 `main.html#planets`에서 확인합니다.
- 행성 지도 안의 `이 지도 보는 법`은 `target="_top"`으로 임베드 밖에서 안내 페이지를 엽니다.

## 생성 기록

2026-09-12, 기본 내장 이미지 생성 도구를 사용했습니다. 원본의 창작 편집은 이미지 생성 도구에서 수행했고, WebP 변환과 웹용 축소만 로컬 이미지 인코더로 처리했습니다. 실제 성운 관측 사진이나 과학 도표로 표시하지 않습니다.

### 배경 최종 프롬프트

> Use case: precise-object-edit. Edit target: the attached approved ORBIT homepage mockup. Extract its beautiful deep navy/indigo/teal nebula BACKGROUND as a production website background image. Remove ALL foreground UI: every letter, all Korean and English text, logo, ellipse and turquoise star, buttons, lines and the article card, footer and copyright. Seamlessly inpaint these removed UI regions with the same dark deep-space backdrop. Preserve the approved nebula composition, colors, detailed dust filaments and sparse stars: blue wisps upper left, bluish violet nebula lower right, broad very dark empty central area for readable webpage content. No new objects, no planets, no new bright highlights, no motion blur. Keep nearly black/navy contrast in center and the original quiet depth, not a vortex. Output a single full-bleed high resolution landscape 16:10 background-only bitmap, ideally 2560x1600 or higher. Absolutely no text, interface or logo.

생성 결과의 실제 원본 크기는 1586 × 992입니다. 프롬프트의 희망 크기를 실제 해상도로 주장하지 않습니다.

### 배경 고해상도 재생성 (2026-09-14)

기존 1584 × 991은 `object-fit: cover`로 화면을 덮을 때 1440p에서 1.6배, 3440px 화면에서 2.2배 확대돼 흐렸습니다.
더 큰 마스터가 없어 같은 아트 디렉션으로 다시 생성했습니다. 이전 배포본을 편집 대상으로 첨부했습니다.

> Use case: precise-object-edit. Edit target: the attached ORBIT homepage background (1584×991). Reproduce this exact image at much higher resolution with no compositional change: identical framing, identical nebula placement, identical color grading, identical dust filament structure and star positions. Add only the fine detail that higher resolution allows — finer dust filaments, cleaner star points, smoother tonal transitions in the dark areas. Do not add, move, remove or recolor any element. Do not introduce planets, bright highlights, vignetting, motion blur or texture overlays. Keep the broad very dark low-contrast central region intact for readable overlaid text. Output a single full-bleed landscape 16:10 background-only bitmap at 3200×2000 or the highest available resolution. Absolutely no text, interface or logo.

생성 결과의 실제 원본 크기는 **2430 × 1457**입니다. 프롬프트가 요청한 3200 × 2000이 아니며, 도구가 낼 수 있는 최대였습니다.
비율도 1.668로 이전 1.598과 다릅니다. 희망 크기를 실제 해상도로 주장하지 않습니다.

채택 전 원본을 디코딩해 확인한 값입니다.

- 라플라시안 평균 3.475. 이전 배포본을 같은 크기로 늘린 값(2.445)의 1.42배이므로 업스케일이 아니라 실제 렌더입니다.
- 중앙부 평균 밝기 11.1, 90 초과 픽셀 0.039%로 흰 제목을 얹기에 충분히 어둡습니다. 이전 배포본은 11.4 / 0.067%였습니다.
- 어두운 영역(밝기 40 미만) 비중 87.0%로 이전 85.4%와 같은 톤입니다.

구도 자체는 완전히 같지 않습니다. 성운 덩어리의 모양과 별 위치가 달라졌고, 가운데 어두운 영역은 더 넓어졌습니다.
운영자가 화면을 확인한 뒤 채택했습니다. 웹 변환(AVIF·WebP 네 폭)만 로컬 인코더로 처리했습니다.

### 수달 최종 프롬프트

> Use case: illustration-story. Create a production transparent-background mascot illustration sheet for ORBIT, a Korean beginner astronomy website. One very wide 3:1 image, ideally 3072x1024, with EXACTLY THREE equal-width square cells in a horizontal row, separated only by abundant empty transparent space, no visible borders. The same adorable original river OTTER character appears once in each cell, at a matching scale and baseline. Rounded soft brown fur, cream muzzle and tummy, little round ears, tiny black nose, short whiskers, bright friendly eyes, a LONG TAPERED OTTER TAIL (not a beaver paddle), small turquoise neck scarf with a tiny orange star pin. Charming polished softly shaded hand-painted 3D/storybook character, cute but tasteful and clear enough at small website size, not photoreal, not pixel art. CELL 1 (left third): otter standing turned three-quarter to the RIGHT, holding a little simple compass in one paw and pointing to its right with the other, showing 'turn your body toward the correct direction'. CELL 2 (middle third): same otter in SIDE VIEW facing RIGHT, looking upward with one paw raised toward the upper-right sky, showing 'look up from the horizon'. CELL 3 (right third): same otter in SIDE VIEW facing RIGHT, eye at the eyepiece of a small elegant turquoise astronomical refractor telescope on a sturdy three-legged tripod, telescope barrel pointed gently toward upper right, showing observing the night sky. Each complete character including tail and props entirely INSIDE its own third of the canvas with at least 12% padding on all edges, same baseline, no artwork touching or crossing between thirds. Transparent alpha around each pose, no background, no cast ground shadow outside cell. No words, letters, digits, labels, arrows, angle markings, star chart or educational diagrams: all exact directions and graphs will be drawn separately in HTML/SVG. No hats or space helmet, no planets, no additional animals, no watermark.

## 검증 범위

기존 링크·메뉴 생성·글 생성 일치 검사와 관측 가이드·첫 화면·공통 메뉴 검사를 사용합니다.
추가 검사는 예시 선택 시 나침반/시선/그래프 동기화, 동쪽·북쪽·천정 경계, 키보드 입력, 좁은 화면, JavaScript 없는 정지 예시, 임베드의 안내 링크를 확인합니다.
로컬 페이지의 수동 화면 미리보기는 Cloud Browser URL 정책으로 제한됐습니다. 자동 검사 통과를 실제 배포 화면의 시각 검수 완료로 표현하지 않습니다.

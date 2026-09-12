# 성운 배경과 수달 관측 안내

사용자가 승인한 첫 화면 목업을 바탕으로 만든 정지 배경과, 별지도 입문 안내용 수달입니다.
기존 GitHub Pages와 페이지 주소를 유지합니다. 브리핑·문의·뉴스·글 발행 예약은 변경하지 않습니다.

## 화면과 자산

- 첫 화면에만 성운을 표시합니다. 별도 고정 이미지 레이어이므로 동작 줄이기 설정에서도 배경은 남고 유성은 사라집니다. 일반 설정에서는 유성 두 개만 유지합니다.
- 공통 `ORBIT.` 로고는 흰색입니다. 메뉴·에디터 별 아이콘·버튼의 기존 강조색은 유지합니다.
- `images/nebula-landing.webp`: 1584 × 991, 138,518 bytes.
- `images/nebula-landing-mobile.webp`: 800 × 500, 35,296 bytes. 화면 너비 600px 이하에서 선택합니다.
- `images/otter-sky-guide.webp`: 1536 × 512, 122,894 bytes, 투명 배경의 세 자세. CSS로 각 3분의 1을 표시해 동일 이미지를 재사용합니다.
- `reading-sky.html`의 수달은 AI로 제작한 설명용 마스코트입니다. 실제 나침반 방향·각도·그래프는 HTML/SVG/JavaScript로 표시하며 이미지 속 자세를 각도 측정값으로 사용하지 않습니다.
- 연습용 목성·토성·금성 위치는 교육용 고정 예시입니다. 실제 계산이나 현재 관측 예보가 아니며, 실제 지도는 기존 `main.html#planets`에서 확인합니다.
- 행성 지도 안의 `이 지도 보는 법`은 `target="_top"`으로 임베드 밖에서 안내 페이지를 엽니다.

## 생성 기록

2026-09-12, 기본 내장 이미지 생성 도구를 사용했습니다. 원본의 창작 편집은 이미지 생성 도구에서 수행했고, WebP 변환과 웹용 축소만 로컬 이미지 인코더로 처리했습니다. 실제 성운 관측 사진이나 과학 도표로 표시하지 않습니다.

### 배경 최종 프롬프트

> Use case: precise-object-edit. Edit target: the attached approved ORBIT homepage mockup. Extract its beautiful deep navy/indigo/teal nebula BACKGROUND as a production website background image. Remove ALL foreground UI: every letter, all Korean and English text, logo, ellipse and turquoise star, buttons, lines and the article card, footer and copyright. Seamlessly inpaint these removed UI regions with the same dark deep-space backdrop. Preserve the approved nebula composition, colors, detailed dust filaments and sparse stars: blue wisps upper left, bluish violet nebula lower right, broad very dark empty central area for readable webpage content. No new objects, no planets, no new bright highlights, no motion blur. Keep nearly black/navy contrast in center and the original quiet depth, not a vortex. Output a single full-bleed high resolution landscape 16:10 background-only bitmap, ideally 2560x1600 or higher. Absolutely no text, interface or logo.

생성 결과의 실제 원본 크기는 1586 × 992입니다. 프롬프트의 희망 크기를 실제 해상도로 주장하지 않습니다.

### 수달 최종 프롬프트

> Use case: illustration-story. Create a production transparent-background mascot illustration sheet for ORBIT, a Korean beginner astronomy website. One very wide 3:1 image, ideally 3072x1024, with EXACTLY THREE equal-width square cells in a horizontal row, separated only by abundant empty transparent space, no visible borders. The same adorable original river OTTER character appears once in each cell, at a matching scale and baseline. Rounded soft brown fur, cream muzzle and tummy, little round ears, tiny black nose, short whiskers, bright friendly eyes, a LONG TAPERED OTTER TAIL (not a beaver paddle), small turquoise neck scarf with a tiny orange star pin. Charming polished softly shaded hand-painted 3D/storybook character, cute but tasteful and clear enough at small website size, not photoreal, not pixel art. CELL 1 (left third): otter standing turned three-quarter to the RIGHT, holding a little simple compass in one paw and pointing to its right with the other, showing 'turn your body toward the correct direction'. CELL 2 (middle third): same otter in SIDE VIEW facing RIGHT, looking upward with one paw raised toward the upper-right sky, showing 'look up from the horizon'. CELL 3 (right third): same otter in SIDE VIEW facing RIGHT, eye at the eyepiece of a small elegant turquoise astronomical refractor telescope on a sturdy three-legged tripod, telescope barrel pointed gently toward upper right, showing observing the night sky. Each complete character including tail and props entirely INSIDE its own third of the canvas with at least 12% padding on all edges, same baseline, no artwork touching or crossing between thirds. Transparent alpha around each pose, no background, no cast ground shadow outside cell. No words, letters, digits, labels, arrows, angle markings, star chart or educational diagrams: all exact directions and graphs will be drawn separately in HTML/SVG. No hats or space helmet, no planets, no additional animals, no watermark.

## 검증 범위

기존 링크·메뉴 생성·글 생성 일치 검사와 관측 가이드·첫 화면·공통 메뉴 검사를 사용합니다.
추가 검사는 예시 선택 시 나침반/시선/그래프 동기화, 동쪽·북쪽·천정 경계, 키보드 입력, 좁은 화면, JavaScript 없는 정지 예시, 임베드의 안내 링크를 확인합니다.
로컬 페이지의 수동 화면 미리보기는 Cloud Browser URL 정책으로 제한됐습니다. 자동 검사 통과를 실제 배포 화면의 시각 검수 완료로 표현하지 않습니다.

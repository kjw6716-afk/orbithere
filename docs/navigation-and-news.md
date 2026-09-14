# 공통 메뉴와 한글 뉴스 제목

## 메뉴 변경

`site-nav.css`와 `site-nav.js`가 12개 콘텐츠 페이지의 데스크톱 사이드바와
모바일 펼침 메뉴를 담당합니다. 홈 진입 화면(index.html)은 별도입니다.
메뉴 항목·순서는 `scripts/site_navigation.py`의 `MENU` 한 곳에서 수정한 뒤
`python3 scripts/site_navigation.py`를 실행하고 변경된 HTML을 함께 커밋합니다.
GitHub Pages 빌드나 방문자의 JavaScript 없이도 직접 페이지의 링크가 남습니다.
`python3 scripts/site_navigation.py --check`는 복사본이 어긋나면 실패합니다.

모바일은 현재 위치, Escape로 닫기 및 버튼으로 포커스 복귀, 바깥 클릭,
짧은 가로 화면에서 메뉴 스크롤을 지원합니다. `?embed=1`에서는 부모 메뉴만
표시합니다. 기존 main.html의 탭·해시·뒤로 가기와 직접 페이지 주소를 유지합니다.

## 본문 너비와 제목 링크 (2026-09-14)

공통 셸은 최대 1680px이며 메인의 도구·게시판과 직접 진입한 본문의 너비 제한을 넓혔습니다.
메인 상단 제목은 선택된 도구·게시판의 직접 페이지로, 각 메뉴의 본문 제목은 해당 페이지로 연결합니다.
게시판 제목 링크는 내부 탐색을 사용해 작성 중 이탈 확인과 내 활동 경로를 유지합니다.
게시판 검색은 목록 아래에 두고, 일반 데스크톱 글 목록은 제목 중심의 한 줄로 표시합니다.
모바일은 16px 제목과 별도의 작성자 정보 줄을 사용합니다.

`board-embed.js`는 게시판의 실제 콘텐츠 높이를 부모에게 알립니다.
부모는 동일 출처와 해당 iframe의 메시지만 받아 높이를 조절합니다.
목록 복귀 위치는 부모의 스크롤을 기준으로 복구하며, 신고·용어 대화상자도 현재 보이는 영역에 놓습니다.
고정 높이 iframe의 내부 스크롤을 숨겨 자르는 방식은 사용하지 않습니다.
글쓰기 선택 항목·댓글·사진·오류 메시지로 높이가 바뀌어도 다시 측정합니다.

## 한글 제목 갱신

공식 RSS의 `title`은 원제 그대로 보존합니다. `titleKo`를 우선 표시하고,
뉴스 목록에서는 원제 펼쳐보기와 한국어 핵심 요약·원문 읽기도 제공합니다.
출처의 공식 한국어 제목인 것처럼 표시하지 않습니다.

- `titleKoOriginal`은 번역한 시점의 원제입니다. 원제가 바뀌면 캐시를 재사용하지 않습니다.
- `titleKoMethod: reviewed`인 제목만 ‘한글 제목’으로 표시합니다.
- 번역을 다듬을 때는 `data/news.json`의 해당 항목을 수정하고 `reviewed`로 바꿉니다.
- 원제가 같으면 다음 RSS 갱신 때도 다듬은 제목을 보존합니다.
- 번역이 없거나 잘못된 형식이면 원제로 표시하며, 뉴스 수집 자체는 계속됩니다.

기존 기관 뉴스의 영어 제목 16개는 원제와 대조해 한글 제목을 다듬었습니다.
새 영어 제목은 2시간 간격의 기존 뉴스 작업에서 CPU로 번역 초안을 저장합니다.
실제 기사로 시험할 때 모델이 고유명사와 천문 용어를 오역했으므로 자동 공개하지 않습니다.
`titleKoDraft`·`titleKoDraftOriginal`·`titleKoDraftModel`은 검토용이며 화면에는 표시하지 않습니다.
초안을 원제와 대조해 다듬은 다음 아래 명령으로 반영하고 커밋합니다.
검토 전에는 원제와 원문 읽기를 제공합니다. 원문과 대조한 별도 요약이 있으면 그 한국어 제목·핵심 요약을 우선 표시합니다.
개인 데이터나 방문자의 브라우저를 번역에 사용하지 않으며 번역 API 키도 필요하지 않습니다.
모델은 GitHub Actions 캐시에만 보관하며 사이트 파일에 포함하지 않습니다.
자동 번역은 과학 용어·고유명사에 오류가 있을 수 있어 원제를 함께 남깁니다.

모델: Meta의 [M2M100 418M](https://huggingface.co/facebook/m2m100_418M), MIT 라이선스.
사용 revision은 `scripts/translate_news.py`에 고정합니다.
[논문: Beyond English-Centric Multilingual Machine Translation](https://arxiv.org/abs/2010.11125).
초기 다운로드 약 2GB와 CPU 추론은 뉴스 갱신 작업에서만 발생합니다.
유료 번역 API는 사용하지 않습니다. 작업 환경의 Actions 사용 정책은 저장소 설정을 따릅니다.

로컬에서 자동 번역만 실행할 때:

```sh
python3 -m venv .venv-news
.venv-news/bin/pip install torch==2.10.0 --index-url https://download.pytorch.org/whl/cpu
.venv-news/bin/pip install -r scripts/translation-requirements.txt
.venv-news/bin/python scripts/translate_news.py --pending
.venv-news/bin/python scripts/translate_news.py
# 원제와 대조해 다듬은 제목만 공개 (모델 의존성 없이도 실행 가능)
python3 scripts/translate_news.py --approve ARTICLE_ID --title "검토한 한글 제목"
```

RSS 파서와 번역 캐시·장애 처리는 `npm run test:news`,
공통 메뉴와 한글 제목·원제 표시 및 fallback은 `npm run test:navigation`으로 확인합니다.
브라우저 검사는 외부 API·광고 요청 없이 실행합니다.

## 기업 뉴스와 종합 패널

- SpaceX(스타링크 포함), Rocket Lab, AST SpaceMobile, Firefly를 기존 KASI·NASA/JPL·ESA와 함께 제공합니다.
- `news-data.js`의 기업 주제와 실제 발행 출처는 별개입니다. NASA의 SpaceX 기사도 SpaceX 필터에 포함하지만 NASA 출처는 유지합니다. 머스크는 우주사업 관련 제목일 때 SpaceX로 분류합니다.
- 목록은 발행일 순입니다. 패널은 기관·기업별 최신 소식을 한 번씩 뽑아 최대 14건을 순환하며, SpaceX 안에서도 스타링크에 차례를 줍니다.
- 너비 861px 이상에서는 기존 뉴스 위젯 한 개를 왼쪽 메뉴의 ‘소개·문의’ 아래로 옮깁니다. 높이 980px 이상에서는 4칸, 821~979px에서는 3칸, 701~820px에서는 2칸, 700px 이하와 모바일 게시판은 1칸입니다. 8초 간격·650ms 세로 이동, 한 칸일 때 220ms 전환과 hover/포커스/동작 줄이기 보호를 유지합니다. 화면 너비를 바꿔도 같은 위젯을 옮겨 재시도·순환 상태를 유지합니다.
- 기관 RSS와 AST의 공개 제목·날짜 JSON은 Python으로, 나머지 기업 공식 뉴스 목록은 `scripts/company_news.mjs`의 Playwright Chromium으로 읽습니다. JavaScript로 표시되는 공개 목록의 제목·날짜·주소만 저장하며 기사 본문과 이미지는 저장하지 않습니다. SpaceX 원문은 `#기사주소`를 보존합니다.
- Starlink의 `/kr/updates`에서는 공식 한국어 제목을 사용합니다. 발행일이 없는 카드는 임의 날짜를 만들지 않고 제외합니다. 소셜 미디어를 별도로 수집하지 않으므로 머스크의 모든 게시물이 들어오는 것은 아닙니다.
- 출처마다 최대 8건입니다(스타링크는 별도 수집 출처이지만 화면에서는 SpaceX로 통합). 새 기업 영어 제목 32건을 검토해 추가했습니다.
- 한 출처의 구조 변경·접속 실패는 해당 출처의 기존 뉴스와 검토한 번역을 보존합니다. 브라우저 전체 실패도 세 기관의 RSS 갱신을 막지 않습니다. 실패 상태는 화면에 표시합니다.

2026-09-14부터 접속이 막힌 Blue Origin 대신 AST SpaceMobile 공식 IR 페이지에 내장된 Issuer Direct 뉴스 피드를 수집합니다. 공유 호스트에서는 ASTS 식별자와 숫자 기사 ID가 있는 보도자료 주소만 허용합니다. 증권 발행과 실적 발표 전화회의 일정 공지는 제외하고, 사업 현황·발사·통신 소식을 담습니다. 최근 1년의 AST 회사 발표 중 최신 8건에서 조건에 맞는 항목을 수집하므로 실제 기사 수는 8건보다 적을 수 있습니다. 기존 Blue Origin 요약은 편집 자료로 보존하며 자동 수집에서는 제외합니다.

로컬 갱신에는 `npm ci`, `npx playwright install chromium`도 필요합니다.
`python3 scripts/update_news.py`가 기관·기업을 함께 갱신합니다.
`npm run test:news`는 공식 페이지에서 확인한 DOM 구조의 fixture, 날짜·주소 검증,
SpaceX fragment 보존, 수집 장애, 혼합 순서, 분류·필터와 반응형 슬라이드를 검증합니다.
공식 페이지 구조가 바뀌면 `company_news.mjs`의 선택자와 해당 fixture를 함께 갱신합니다.

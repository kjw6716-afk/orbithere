# 검색과 콘텐츠 운영

2026-09-12 공개 검색에서 `site:orbithere.com`, `"orbithere.com"` 결과를 찾지 못했습니다.
이것만으로 Google·네이버 색인 여부나 노출이 0이라고 단정할 수 없습니다.
공개 검색 조사 당시에는 검색어 실적·소유자 도구의 등록 상태에 접근하지 않았습니다.

같은 날 운영자가 GSC Wizard를 연결한 뒤 `sc-domain:orbithere.com` 도메인 속성과 실제 Google 검색 실적 조회를 확인했습니다. 최신 집계 완료 날짜·클릭·노출·검색어·페이지 조회를 기존 아침 Gmail 브리핑에 반영했습니다. 실제 수치와 검색어는 공개 저장소에 남기지 않습니다. 검색 실적 조회 성공만으로 모든 페이지의 색인이 확인되는 것은 아닙니다. 운영자는 기존 사이트맵의 13개 URL 처리 성공을 확인했습니다. 사이트맵 처리와 개별 URL 색인은 별도로 판단합니다. 실행 규칙은 [`_editorial/MORNING_BRIEF.md`](../_editorial/MORNING_BRIEF.md)를 참고하세요.

## 실제 노출을 확인하는 방법

1. Google Search Console의 기존 `sc-domain:orbithere.com` 도메인 속성을 사용합니다. GSC Wizard에서 접근 가능함을 확인했으므로 중복 속성을 만들 필요가 없습니다.
   소유 확인을 다시 해야 할 때는 실제 발급된 인증 파일·메타 태그·DNS 값을 사용하며 인증 값을 만들어 넣지 않습니다.
2. 기존 사이트맵 `https://orbithere.com/sitemap.xml`은 운영자가 13개 URL 처리 성공을 확인했습니다. 성공한 사이트맵을 반복 제출하지 않습니다.
3. 아래 핵심 URL부터 색인 상태를 확인합니다. GSC Wizard의 조회와 Search Console의 실제 URL 테스트·색인 생성 요청을 구분하고, 이미 요청한 주소는 반복 제출하지 않습니다.
4. 실적 → 검색 결과 → 검색어에서 실제 노출 검색어·클릭·노출·평균 게재순위를 확인합니다.
   드물거나 익명화된 검색어는 모두 제공되지 않습니다.
5. 네이버 서치어드바이저에서도 소유 확인 후 같은 사이트맵을 제출하고 수집·색인 상태를 확인합니다.

확인용 검색: `site:orbithere.com`, `"orbithere.com"`, `오빗 밤하늘`.
확장할 주제: `행성 고도 보는 법`, `별 관측 기록`, `유성우 관측 준비`.
이들은 목표 검색 주제이며 현재 순위나 검색량이 검증된 키워드 목록이 아닙니다.

## 핵심 URL 후속 점검 절차

운영자가 지정한 다음 주소를 우선 점검합니다. 이미 확인한 전체 페이지를 매번 재검사하지 않습니다.

| 페이지 | 검사할 대표 주소 |
| --- | --- |
| 행성 관측 도구 | `https://orbithere.com/planets.html` |
| 관측 가이드 | `https://orbithere.com/guide.html` |
| 별지도 설명 | `https://orbithere.com/reading-sky.html` |
| 우주 이야기 목록 | `https://orbithere.com/stories.html` |
| 첫 글 | `https://orbithere.com/stories/moon-face-and-phases.html` |

1. URL 검사에서 상태·마지막 크롤링 시각을 이전 기록과 비교합니다. GSC Wizard의 URL Inspection API는 Google이 보관한 색인 상태를 조회하며, 실제 URL 테스트나 색인 생성 요청을 실행하지 않습니다. `UNSPECIFIED`를 차단으로 해석하지 않습니다.
2. 실제 HTTP 응답·robots.txt·검색 차단 메타/헤더·canonical·정적 본문·내부 링크·사이트맵 포함 여부를 대상 페이지에 한해 확인합니다. 일반 HTTP 요청 성공은 Googlebot의 실제 접근 성공을 증명하지 않으며, HTML의 canonical과 Google이 선택한 대표 URL도 구분합니다.
3. 기술적 결함이 확인되면 해당 부분만 수정합니다. 미색인이라는 이유만으로 URL·본문·canonical·lastmod를 바꾸거나 새 검색 속성을 만들지 않습니다.
4. 개별 색인 요청을 아직 하지 않았다면 Search Console의 기존 도메인 속성에서 실제 URL 테스트 후, 통과한 주소에 한해 색인 생성을 한 번 요청합니다. 이미 요청했다면 같은 주소를 반복 제출하지 않습니다.
5. 후속 점검은 수일 간격으로 필요한 URL만 비교합니다. 크롤링은 수일에서 수주 걸릴 수 있으며 요청이 색인을 보장하지 않습니다. `Discovered - currently not indexed`는 아직 크롤링 전인 상태입니다. `Crawled - currently not indexed`나 중복·다른 canonical 상태가 나타나면 해당 페이지의 렌더링·본문 가치·중복·Google 선택 canonical을 점검합니다.
6. 기존 Gmail 브리핑·문의 라벨·뉴스 요약·우주 이야기 자동화를 중복 생성하지 않습니다. 콘텐츠 초안 PR은 운영자 검토·병합 후 공개하는 절차를 유지합니다.

실제 GSC 검사 결과와 비공개 검색 실적은 이 공개 문서에 추가하지 않습니다.

근거: [페이지 색인 상태 설명](https://support.google.com/webmasters/answer/7440203),
[URL Inspection API 범위](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect),
[크롤링 요청과 대기 시간](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

## 구현된 기반

- 홈페이지 제목에 한글 브랜드와 실제 제공 기능을 명시하고 WebSite 구조화 데이터를 추가했습니다.
- 글마다 고유 URL·제목·설명·canonical과 내부 링크를 제공합니다.
- 별지도 읽는 법은 본문 HTML과 설명 그림, 작성일·참고 출처가 있는 독립 글입니다.
- 우주 이야기는 출처를 밝힌 AI 해설을 검토 후 발행합니다. 실제 관측 후기로 가장하지 않습니다. 종료된 관측 노트의 저장본은 내보내기 안내에서 보관할 수 있습니다.
- 새 페이지를 사이트맵에 넣었습니다. 구조화 데이터나 사이트맵은 검색 노출을 보장하지 않습니다.

## 다음 콘텐츠 우선순위

1. **실제 관측 기록**: 직접 촬영한 사진, 날짜·시간, 대략적인 지역, 장비, 구름·조명,
   성공/실패와 다음 시도. 실제 경험과 설명용 예시를 구분합니다.
2. **행사별 관측 해설**: 공식 일정 출처와 KST, 국내에서 실제로 볼 시간, 달빛·시야 등 판단 근거.
   단순 일정 복사 대신 국내 이용자가 오늘 무엇을 결정해야 하는지 설명합니다.
3. **장비 비교**: 직접 사용한 범위, 운반·설치·흔들림·실제 관측 결과를 밝히고 제휴 링크는 표시합니다.
4. **장소 기록**: 직접 확인한 출입 시간·교통·가림·조명 정보에 확인일을 붙입니다.
   확인하지 않은 곳을 ‘추천 명소’로 채우지 않습니다.

메뉴의 우주 이야기와 기존 가이드가 콘텐츠 허브 역할을 합니다.
독립된 실제 글이 모인 뒤 ‘관측 후기 모음’·‘장비 비교’ 같은 하위 분류를 확장합니다.

공식 자료:
- https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site
- https://support.google.com/webmasters/answer/7576553
- https://support.google.com/webmasters/answer/9008080
- https://searchadvisor.naver.com/guide/request-feed

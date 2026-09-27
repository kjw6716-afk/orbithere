# 게시판 본문·댓글 간격 검증

[제품 PR #115](https://github.com/kjw6716-afk/orbithere/pull/115)의 변경 전후 화면입니다. 동일한 가상 글·댓글과 Pretendard 글꼴로 1280px / 360px에서 캡처했습니다. 운영 데이터와 운영 API 요청을 사용하지 않았습니다.

## 높이 측정

짧은 댓글 5개(본인 3개, 타인 2개)의 전체 높이입니다. 구분선을 포함합니다.

| 화면 | 폭 | 변경 전 | 변경 후 | 감소 |
|---|---:|---:|---:|---:|
| lounge 직접 방문 | 1280px | 725.94px | 442.97px | 39.0% |
| main 게시판 iframe | 1280px | 725.94px | 442.97px | 39.0% |
| lounge 직접 방문 | 360px | 725.94px | 442.97px | 39.0% |
| main 게시판 iframe | 360px | 725.94px | 442.97px | 39.0% |

한 줄 댓글 하나는 145.19px → 88.59px입니다. 본문과 댓글의 글자 크기 16px를 유지했습니다.

본문은 문단 요소 없이 텍스트와 링크를 표시하며 문단 margin은 0px입니다. 작성자가 넣은 빈 줄이 `white-space: pre-wrap`으로 표시되는 구조입니다. 줄높이는 30.4px → 26.4px이고, 빈 줄 하나의 추가 높이도 약 30.39px → 26.39px입니다. 원문의 모든 줄바꿈과 문단 구조가 유지됩니다.

## 화면

| 짧은 댓글 5개 | 변경 전 | 변경 후 |
|---|---|---|
| 데스크톱 직접 방문 | [이미지](before-desktop-direct-short-comments.png) | [이미지](after-desktop-direct-short-comments.png) |
| 데스크톱 iframe | [이미지](before-desktop-iframe-short-comments.png) | [이미지](after-desktop-iframe-short-comments.png) |
| 모바일 직접 방문 | [이미지](before-mobile-direct-short-comments.png) | [이미지](after-mobile-direct-short-comments.png) |
| 모바일 iframe | [이미지](before-mobile-iframe-short-comments.png) | [이미지](after-mobile-iframe-short-comments.png) |

| 여러 문단·긴 링크·사진·긴 댓글 | 변경 전 | 변경 후 |
|---|---|---|
| 데스크톱 직접 방문 | [전체 화면](before-desktop-direct-long.png) | [전체 화면](after-desktop-direct-long.png) |
| 모바일 iframe | [전체 화면](before-mobile-iframe-long.png) | [전체 화면](after-mobile-iframe-long.png) |

## 확인 결과

- 짧은 글, 여러 문단과 연속 빈 줄, 긴 링크, 첨부 사진 확인. 본문 textContent가 원문과 정확히 일치합니다.
- 한 글자·한 줄·여러 줄 댓글, 긴 단어, 복합 이모지, 긴 닉네임·레벨 배지, 본인·타인 댓글 확인.
- 4개 화면 모드에서 가로 넘침, 버튼/본문·작성자 겹침, 배지 잘림 없음. iframe 높이가 콘텐츠를 수용합니다.
- 삭제·신고·새로고침 버튼의 터치 영역 44px 이상. 새로고침 Enter, Tab으로 삭제 이동과 포커스 표시, 삭제 Enter 모두 통과했습니다.
- 관리자 계정의 타인 댓글 삭제+신고 버튼 2개도 4개 화면 모드에서 겹침·잘림 없이 확인했습니다.
- 변경 전 8개, 변경 후 8개, 관리자 4개 시나리오에서 브라우저 예외 없음.
- 최종 제품 트리 `cc4aab758c88b6931d8050d5046e392a2f2277b4` 기준 전체 `npm test` 종료 코드 0, 게시판 회귀 435개 통과.
- [GitHub CI 재실행 성공](https://github.com/kjw6716-afk/orbithere/actions/runs/36296715390/attempts/2). 첫 실행은 이번 변경과 무관한 account.html 회원 검사 412번째에서 시간 초과했으며, 코드나 timeout 변경 없이 재실행이 통과했습니다.

제품 PR head: `5e978605572e01b9f9bc12f141fb4bd275846bf6`. 이 브랜치는 검토용 증빙이며 제품 PR을 병합하지 않습니다.

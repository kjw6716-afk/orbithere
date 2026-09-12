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

## 한글 제목 갱신

공식 RSS의 `title`은 원제 그대로 보존합니다. `titleKo`를 우선 표시하고,
뉴스 목록에서는 원제와 원문·Google 한국어 번역 링크도 제공합니다.
출처의 공식 한국어 제목인 것처럼 표시하지 않습니다.

- `titleKoOriginal`은 번역한 시점의 원제입니다. 원제가 바뀌면 캐시를 재사용하지 않습니다.
- `titleKoMethod: reviewed`인 제목만 ‘한글 제목’으로 표시합니다.
- 번역을 다듬을 때는 `data/news.json`의 해당 항목을 수정하고 `reviewed`로 바꿉니다.
- 원제가 같으면 다음 RSS 갱신 때도 다듬은 제목을 보존합니다.
- 번역이 없거나 잘못된 형식이면 원제로 표시하며, 뉴스 수집 자체는 계속됩니다.

현재 16개 영어 제목은 원제와 대조해 한글 제목을 다듬었습니다.
새 영어 제목은 6시간 간격의 기존 뉴스 작업에서 CPU로 번역 초안을 저장합니다.
실제 기사로 시험할 때 모델이 고유명사와 천문 용어를 오역했으므로 자동 공개하지 않습니다.
`titleKoDraft`·`titleKoDraftOriginal`·`titleKoDraftModel`은 검토용이며 화면에는 표시하지 않습니다.
초안을 원제와 대조해 다듬은 다음 아래 명령으로 반영하고 커밋합니다.
검토 전에는 원제와 Google 한국어 번역 링크를 제공합니다.
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

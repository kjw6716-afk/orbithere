# _archive — 보류 중인 페이지

사이트에서 내렸지만 **지우지 않고 보관**하는 페이지들입니다. 다시 쓰고 싶어지면 여기서 꺼내면 됩니다.

| 파일 | 원래 주소 | 내린 날 | 이유 |
|---|---|---|---|
| `lucky.html` | `/lucky.html` | 2026-08-02 | 로또·연금복권 추첨기. 천문 관측 커뮤니티라는 방향과 맞지 않아 보류 |
| `fortune.html` | `/fortune.html` | 2026-08-02 | 별자리·띠 운세. 같은 이유로 보류 |

## 왜 `_` 로 시작하나

GitHub Pages는 기본적으로 Jekyll로 빌드하는데, Jekyll은 **밑줄로 시작하는 디렉터리를 빌드 결과에 넣지 않습니다.**
그래서 `_archive/` 안의 파일은 `orbithere.com`에서 접근되지 않습니다. 안전망으로 두 파일 모두
`<meta name="robots" content="noindex, nofollow">` 를 넣어두었고, `robots.txt`에도 `Disallow: /_archive/` 가 있습니다.

> 레포에 `.nojekyll` 파일을 추가하거나 Pages 배포 방식을 GitHub Actions 워크플로로 바꾸면
> Jekyll을 거치지 않게 되어 이 디렉터리가 그대로 공개됩니다. 그때는 파일을 레포 밖으로 옮기세요.

## 되살리는 방법

1. `git mv _archive/lucky.html lucky.html` (필요한 파일만)
2. 파일 맨 위에 넣어둔 `robots` meta와 보류 안내 주석을 지운다
3. 아래를 다시 연결한다 — 내릴 때 **끊어둔 곳들**이다
   - `main.html` — 사이드바 `.nav-item` 한 줄, `<section class="panel">` + iframe, `TITLES` 맵, iframe 지연 로딩 분기, `postMessage` 높이 수신 맵(`frameOf`)
   - 각 페이지 푸터 `.foot-links`, `index.html` 의 `.quick-links`
   - `sitemap.xml`, `README.md`
   - `terms.html` — Lucky Orbit용 면책 조항(구 제6조)을 되살릴지 확인
4. 되살린 파일 안의 링크도 확인한다. 내릴 당시 두 파일은 서로를, 그리고 지금은 없는 `profile.html`을 참조하고 있었다.

## 같이 지운 것

`profile.html` 은 보관하지 않고 삭제했습니다 (레벨·XP·스탯이 전부 정적 값이라 되살릴 가치가 없다고 판단).
필요하면 커밋 `34a3e8f` 이전 히스토리에서 꺼낼 수 있습니다.

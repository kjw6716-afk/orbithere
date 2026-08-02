# Orbit — 전체 소스 스냅샷

**orbithere.com · 밤하늘 관측 커뮤니티**
기준 커밋 `d59dd07` · 생성일 2026-08-02

이 파일 하나에 사이트를 이루는 **모든 소스 코드**가 들어 있습니다. 레포 접근 없이
코드만 넘겨야 할 때 이것만 전달하면 됩니다. 각 파일 앞에 그 파일이 무엇인지 한 문단씩 붙였습니다.

> 이건 **사본이자 스냅샷**입니다. 원본은 레포 루트의 실제 파일이고, 코드가 바뀌면 이 파일은 낡습니다.
> 사이트가 무엇이고 어떻게 손대는지는 같은 폴더의 `README.md`를 먼저 읽으세요.

**포함하지 않은 것**
- 바이너리: `images/og.png` `images/otter.png` `favicon.ico` `favicon-32.png` `icon-192.png` `icon-512.png` `apple-touch-icon*.png`
- `_archive/lucky.html` `_archive/fortune.html` — 2026-08-02에 사이트에서 내린 로또 추첨기·운세 페이지.
  현행 사이트의 일부가 아니라 제외했습니다(레포에는 그대로 있고, 되살리는 방법은 `_archive/README.md`에).
- `PROJECT_STATUS.md`, `_handover/README.md` — 코드가 아니라 문서라서 제외.

---

## 목차

- [`index.html`](#indexhtml)
- [`main.html`](#mainhtml)
- [`sky.html`](#skyhtml)
- [`lounge.html`](#loungehtml)
- [`admin.html`](#adminhtml)
- [`terms.html`](#termshtml)
- [`privacy.html`](#privacyhtml)
- [`404.html`](#404html)
- [`orbit.css`](#orbitcss)
- [`effects.js`](#effectsjs)
- [`supabase/schema.sql`](#supabaseschemasql)
- [`supabase/migration_002_delete.sql`](#supabasemigration_002_deletesql)
- [`supabase/migration_003_rate_limit.sql`](#supabasemigration_003_rate_limitsql)
- [`supabase/migration_004_comments.sql`](#supabasemigration_004_commentssql)
- [`supabase/migration_005_admin.sql`](#supabasemigration_005_adminsql)
- [`supabase/migration_006_pet_orbit.sql`](#supabasemigration_006_pet_orbitsql)
- [`supabase/migration_007_reports.sql`](#supabasemigration_007_reportssql)
- [`supabase/migration_008_sky_orbits.sql`](#supabasemigration_008_sky_orbitssql)
- [`supabase/migrate_emoji_2026-07.sql`](#supabasemigrate_emoji_2026-07sql)
- [`robots.txt`](#robotstxt)
- [`sitemap.xml`](#sitemapxml)
- [`site.webmanifest`](#sitewebmanifest)
- [`CNAME`](#cname)
- [`favicon.svg`](#faviconsvg)
- [`README.md`](#readmemd)
- [`_archive/README.md`](#_archivereadmemd)

---


## `index.html`

> 325줄 · 16834바이트

랜딩. CSS 애니메이션(유성우 20개 + 공전하는 젤리별)만 있고 로직은 맨 아래 클릭 핸들러 하나. 아무 데나 클릭하면 700ms 뒤 main.html로 넘어간다. 하단 바로가기는 검색엔진이 따라갈 실제 링크라 전환에서 제외한다.

````html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orbit — 궤도에서 너를 만나다</title>
    <meta name="description" content="비슷한 궤도를 도는 사람들이 만나는 커뮤니티, 오빗(Orbit).">
    <meta name="theme-color" content="#0F172A">
    <link rel="canonical" href="https://orbithere.com/">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Orbit">
    <meta property="og:title" content="Orbit — 궤도에서 너를 만나다">
    <meta property="og:description" content="비슷한 궤도를 도는 사람들이 만나는 커뮤니티, 오빗(Orbit).">
    <meta property="og:image" content="https://orbithere.com/images/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="https://orbithere.com/">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
    <link rel="stylesheet" href="/orbit.css">
    <style>
        body {
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background-color: #0F172A;
            color: #E2E8F0;
            font-family: 'Pretendard', sans-serif;
            overflow: hidden;
            touch-action: manipulation;
        }

        .starfield {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0; pointer-events: none;
        }

        .meteor {
            position: absolute;
            top: -100px;
            width: 1px; height: 85px;
            background: linear-gradient(to bottom, rgba(79, 209, 197, 0), #4FD1C5);
            border-radius: 999px;
            transform: rotate(45deg);
            animation: fall linear infinite;
            opacity: 0;
            filter: drop-shadow(0 0 4px #4FD1C5);
        }

        .meteor:nth-child(1)  { left: 10%;  animation-duration: 5s; }
        .meteor:nth-child(2)  { left: 25%;  animation-duration: 7.5s; animation-delay: 1s; }
        .meteor:nth-child(3)  { left: 45%;  animation-duration: 6s;   animation-delay: 0.5s; }
        .meteor:nth-child(4)  { left: 60%;  animation-duration: 9s;   animation-delay: 2.2s; }
        .meteor:nth-child(5)  { left: 80%;  animation-duration: 4.5s; animation-delay: 1.5s; height: 110px; }
        .meteor:nth-child(6)  { left: 100%; animation-duration: 7s;   animation-delay: 0.2s; }
        .meteor:nth-child(7)  { left: 120%; animation-duration: 8.5s; animation-delay: 3s; }
        .meteor:nth-child(8)  { left: 140%; animation-duration: 5.5s; animation-delay: 2.5s; }
        .meteor:nth-child(9)  { left: 150%; animation-duration: 7.2s; animation-delay: 4s; }
        .meteor:nth-child(10) { left: 15%;  animation-duration: 6.8s; animation-delay: 1.2s; }
        .meteor:nth-child(11) { left: 35%;  animation-duration: 8.2s; animation-delay: 2.5s; }
        .meteor:nth-child(12) { left: 55%;  animation-duration: 5.8s; animation-delay: 0.8s; }
        .meteor:nth-child(13) { left: 75%;  animation-duration: 7.5s; animation-delay: 1.8s; }
        .meteor:nth-child(14) { left: 95%;  animation-duration: 8.8s; animation-delay: 3.3s; }
        .meteor:nth-child(15) { left: 115%; animation-duration: 6.2s; animation-delay: 0.7s; }
        .meteor:nth-child(16) { left: 135%; animation-duration: 7.8s; animation-delay: 2.5s; }
        .meteor:nth-child(17) { left: 50%;  animation-duration: 5.2s; animation-delay: 1.9s; }
        .meteor:nth-child(18) { left: 130%; animation-duration: 8.4s; animation-delay: 0.3s; }
        .meteor:nth-child(19) { left: 145%; animation-duration: 7s;   animation-delay: 3.9s; }
        .meteor:nth-child(20) { left: 5%;   animation-duration: 6.5s; animation-delay: 2.1s; }

        @keyframes fall {
            0%   { transform: translate(0, 0) rotate(45deg); opacity: 0; }
            10%  { opacity: 0.8; }
            80%  { opacity: 0.3; }
            100% { transform: translate(-1200px, 1200px) rotate(45deg); opacity: 0; }
        }

        .content {
            position: relative;
            z-index: 1;
            text-align: center;
        }

        .star-system {
            position: relative;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            width: 220px; height: 100px;
            margin-bottom: 30px;
        }

        .tilt-wrapper {
            position: relative;
            width: 200px; height: 60px;
            transform: rotate(-25deg);
            margin-top: 30px; margin-left: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .orbit-ring {
            position: absolute;
            width: 100%; height: 100%;
            border: 1px solid #4FD1C5;
            border-radius: 50%;
            box-sizing: border-box;
        }

        .ring-back  { z-index: 2; }
        .ring-front { z-index: 4; clip-path: polygon(0 50%, 100% 50%, 100% 100%, 0 100%); }

        .gummy-star {
            position: absolute;
            width: 26px; height: 26px;
            top: 50%; left: 50%;
            margin-top: -13px; margin-left: -13px;
            fill: #4FD1C5; stroke: #4FD1C5;
            stroke-width: 14; stroke-linejoin: round; stroke-linecap: round;
            --rx: 100px; --ry: 30px;
            animation: star-orbit 7.5s linear infinite;
        }

        @keyframes star-orbit {
            0%    { transform: translate(calc(var(--rx)*1),   calc(var(--ry)*0))    rotate(0deg)    scale(1);    z-index:1; }
            4.16% { transform: translate(calc(var(--rx)*0.966),calc(var(--ry)*-0.259)) rotate(-15deg)  scale(0.98); z-index:1; }
            8.33% { transform: translate(calc(var(--rx)*0.866),calc(var(--ry)*-0.5))   rotate(-30deg)  scale(0.96); z-index:1; }
            12.5% { transform: translate(calc(var(--rx)*0.707),calc(var(--ry)*-0.707)) rotate(-45deg)  scale(0.92); z-index:1; }
            16.66%{ transform: translate(calc(var(--rx)*0.5),  calc(var(--ry)*-0.866)) rotate(-60deg)  scale(0.89); z-index:1; }
            20.83%{ transform: translate(calc(var(--rx)*0.259),calc(var(--ry)*-0.966)) rotate(-75deg)  scale(0.86); z-index:1; }
            25%   { transform: translate(0px,                  calc(var(--ry)*-1))     rotate(-90deg)  scale(0.85); z-index:1; }
            29.16%{ transform: translate(calc(var(--rx)*-0.259),calc(var(--ry)*-0.966)) rotate(-105deg) scale(0.86); z-index:1; }
            33.33%{ transform: translate(calc(var(--rx)*-0.5),  calc(var(--ry)*-0.866)) rotate(-120deg) scale(0.89); z-index:1; }
            37.5% { transform: translate(calc(var(--rx)*-0.707),calc(var(--ry)*-0.707)) rotate(-135deg) scale(0.92); z-index:1; }
            41.66%{ transform: translate(calc(var(--rx)*-0.866),calc(var(--ry)*-0.5))   rotate(-150deg) scale(0.96); z-index:1; }
            45.83%{ transform: translate(calc(var(--rx)*-0.966),calc(var(--ry)*-0.259)) rotate(-165deg) scale(0.98); z-index:1; }
            49.99%{ transform: translate(calc(var(--rx)*-1),   0px)                     rotate(-180deg) scale(1);    z-index:1; }
            50%   { transform: translate(calc(var(--rx)*-1),   0px)                     rotate(-180deg) scale(1);    z-index:5; }
            54.16%{ transform: translate(calc(var(--rx)*-0.966),calc(var(--ry)*0.259))  rotate(-195deg) scale(1.02); z-index:5; }
            58.33%{ transform: translate(calc(var(--rx)*-0.866),calc(var(--ry)*0.5))    rotate(-210deg) scale(1.04); z-index:5; }
            62.5% { transform: translate(calc(var(--rx)*-0.707),calc(var(--ry)*0.707))  rotate(-225deg) scale(1.08); z-index:5; }
            66.66%{ transform: translate(calc(var(--rx)*-0.5),  calc(var(--ry)*0.866))  rotate(-240deg) scale(1.11); z-index:5; }
            70.83%{ transform: translate(calc(var(--rx)*-0.259),calc(var(--ry)*0.966))  rotate(-255deg) scale(1.14); z-index:5; }
            75%   { transform: translate(0px,                   calc(var(--ry)*1))       rotate(-270deg) scale(1.15); z-index:5; }
            79.16%{ transform: translate(calc(var(--rx)*0.259), calc(var(--ry)*0.966))  rotate(-285deg) scale(1.14); z-index:5; }
            83.33%{ transform: translate(calc(var(--rx)*0.5),   calc(var(--ry)*0.866))  rotate(-300deg) scale(1.11); z-index:5; }
            87.5% { transform: translate(calc(var(--rx)*0.707), calc(var(--ry)*0.707))  rotate(-315deg) scale(1.08); z-index:5; }
            91.66%{ transform: translate(calc(var(--rx)*0.866), calc(var(--ry)*0.5))    rotate(-330deg) scale(1.04); z-index:5; }
            95.83%{ transform: translate(calc(var(--rx)*0.966), calc(var(--ry)*0.259))  rotate(-345deg) scale(1.02); z-index:5; }
            99.99%{ transform: translate(calc(var(--rx)*1),     0px)                     rotate(-360deg) scale(1);    z-index:5; }
            100%  { transform: translate(calc(var(--rx)*1),     0px)                     rotate(-360deg) scale(1);    z-index:1; }
        }

        .title {
            font-size: 1.5rem;
            font-weight: 200;
            letter-spacing: -0.05em;
            color: #E2E8F0;
            margin: 0;
            text-shadow: 0 0 30px rgba(15, 23, 42, 1);
        }

        .highlight { color: #4FD1C5; font-weight: 500; }

        .subtitle {
            font-size: 0.8rem;
            color: #4FD1C5;
            opacity: 0.5;
            margin-top: 10px;
            letter-spacing: 0.08em;
            font-weight: 300;
        }

        /* 클릭 힌트 — 키보드 사용자를 위해 실제 링크로 둔다 (Tab → Enter 입장) */
        .click-hint {
            display: inline-block;
            margin-top: 40px;
            font-size: 0.72rem;
            color: #4FD1C5;
            text-decoration: none;
            opacity: 0;
            letter-spacing: 0.2em;
            font-weight: 300;
            animation: hint-pulse 2.5s ease-in-out 1.2s infinite;
        }
        .click-hint:focus-visible { opacity: 0.8; outline: 1px solid rgba(79,209,197,0.5); outline-offset: 6px; }

        /* 하단 바로가기 — 검색엔진이 따라갈 수 있는 실제 링크 */
        .quick-links {
            position: fixed; bottom: 22px; left: 0; right: 0;
            z-index: 2; text-align: center;
            display: flex; justify-content: center; gap: 18px; flex-wrap: wrap;
            padding: 0 16px;
        }
        .quick-links a {
            font-size: 0.72rem; color: rgba(226,232,240,0.5);
            text-decoration: none; letter-spacing: 0.04em;
            transition: color 0.2s;
        }
        .quick-links a:hover { color: #4FD1C5; }
        .quick-links .foot-copy {
            width: 100%; margin-top: 5px;
            font-size: 0.62rem; color: rgba(226,232,240,0.35);
            letter-spacing: 0.06em;
            display: flex; align-items: center; justify-content: center; gap: 5px;
        }
        .foot-star { width: 11px; height: 11px; flex-shrink: 0; animation: foot-twinkle 2.8s ease-in-out infinite; }
        @keyframes foot-twinkle {
            0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.85; }
            50%      { transform: scale(1.2) rotate(18deg); opacity: 1; }
        }

        @keyframes hint-pulse {
            0%,100% { opacity: 0.2; }
            50%      { opacity: 0.6; }
        }

        @media (max-width: 768px) {
            .title    { font-size: 1.2rem; }
            .subtitle { font-size: 0.72rem; }
            .star-system  { width: 170px; }
            .tilt-wrapper { width: 150px; height: 45px; margin-top: 24px; margin-left: 6px; }
            .gummy-star   { width: 20px; height: 20px; margin-top: -10px; margin-left: -10px; --rx: 75px; --ry: 22.5px; }
            .meteor { animation-name: fall-mobile; }
            .meteor:nth-child(1)  { left: 20%; }
            .meteor:nth-child(2)  { left: 50%; }
            .meteor:nth-child(3)  { left: 90%; }
            .meteor:nth-child(4)  { left: 120%; }
            .meteor:nth-child(5)  { left: 160%; }
            .meteor:nth-child(6)  { left: 200%; }
            .meteor:nth-child(7)  { left: 240%; }
            .meteor:nth-child(8)  { left: 280%; }
            .meteor:nth-child(9)  { left: 300%; }
            .meteor:nth-child(10) { left: 30%; }
            .meteor:nth-child(11) { left: 70%; }
            .meteor:nth-child(12) { left: 110%; }
            .meteor:nth-child(13) { left: 150%; }
            .meteor:nth-child(14) { left: 190%; }
            .meteor:nth-child(15) { left: 230%; }
            .meteor:nth-child(16) { left: 270%; }
            .meteor:nth-child(17) { left: 100%; }
            .meteor:nth-child(18) { left: 260%; }
            .meteor:nth-child(19) { left: 290%; }
            .meteor:nth-child(20) { left: 10%; }
        }

        @keyframes fall-mobile {
            0%   { transform: translate(0, 0) rotate(45deg); opacity: 0; }
            10%  { opacity: 0.8; }
            80%  { opacity: 0.3; }
            100% { transform: translate(-1600px, 1600px) rotate(45deg); opacity: 0; }
        }

        ::selection      { background-color: #FFB74D; color: #0F172A; }
        ::-moz-selection { background-color: #FFB74D; color: #0F172A; }


    </style>
    <script src="effects.js" defer></script>
</head>
<body>
    <div class="starfield">
        <div class="meteor"></div><div class="meteor"></div><div class="meteor"></div><div class="meteor"></div><div class="meteor"></div>
        <div class="meteor"></div><div class="meteor"></div><div class="meteor"></div><div class="meteor"></div><div class="meteor"></div>
        <div class="meteor"></div><div class="meteor"></div><div class="meteor"></div><div class="meteor"></div><div class="meteor"></div>
        <div class="meteor"></div><div class="meteor"></div><div class="meteor"></div><div class="meteor"></div><div class="meteor"></div>
    </div>

    <div class="content">
        <div class="star-system">
            <div class="tilt-wrapper">
                <div class="orbit-ring ring-back"></div>
                <svg class="gummy-star" viewBox="0 0 100 100">
                    <path d="M 50 15 L 62 34 L 83 39 L 69 56 L 71 78 L 50 70 L 29 78 L 31 56 L 17 39 L 38 34 Z" />
                </svg>
                <div class="orbit-ring ring-front"></div>
            </div>
        </div>
        <h1 class="title">궤도에서 <span class="highlight">너를</span> 만나다</h1>
        <p class="subtitle">비슷한 궤도를 도는 사람들이 모이는 곳</p>
        <a class="click-hint" href="main.html">아무곳이나 클릭</a>
    </div>

    <nav class="quick-links">
        <a href="main.html">커뮤니티 홈</a>
        <a href="sky.html">밤하늘 달력</a>
        <a href="lounge.html">글 남기기</a>
        <a href="terms.html">이용약관</a>
        <a href="privacy.html">개인정보처리방침</a>
        <span class="foot-copy">© 2026 Orbit · Made with
            <svg class="foot-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M 50 15 L 62 34 L 83 39 L 69 56 L 71 78 L 50 70 L 29 78 L 31 56 L 17 39 L 38 34 Z" fill="#FF9F43" stroke="#FF9F43" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/></svg>
            in orbit</span>
    </nav>

    <script>
        document.body.style.cursor = 'pointer';

        document.body.addEventListener('click', (e) => {
            // 하단 바로가기는 각자 목적지가 있으니 입장 전환에서 제외
            if (e.target.closest('.quick-links')) return;
            // 힌트 링크는 즉시 이동 대신 아래의 700ms 전환을 같이 탄다
            // (JS가 꺼져 있으면 링크 본연의 즉시 이동으로 동작)
            if (e.target.closest('.click-hint')) e.preventDefault();
            // 파티클은 effects.js가 그림 — 여기선 입장 전환만
            setTimeout(() => {
                window.location.href = 'main.html';
            }, 700);
        });
    </script>
</body>
</html>
````


## `main.html`

> 598줄 · 31354바이트

앱 셸. 사이드바 2탭(밤하늘 달력 / 글 남기기)이 각각 sky.html·lounge.html을 ?embed=1 iframe으로 띄운다. 처음 열 때만 src를 채우는 지연 로딩. 상단 칩이 궤도 진입(닉네임) 대화상자의 유일한 입구다. iframe에서 오는 postMessage(join / skyHeight)를 여기서 받는다.

````html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orbit | Community</title>
    <meta name="description" content="밤하늘을 같이 보는 사람들이 모이는 곳 — 오빗 커뮤니티.">
    <meta name="theme-color" content="#0F172A">
    <link rel="canonical" href="https://orbithere.com/main.html">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Orbit">
    <meta property="og:title" content="Orbit | Community">
    <meta property="og:description" content="밤하늘을 같이 보는 사람들이 모이는 곳 — 오빗 커뮤니티.">
    <meta property="og:image" content="https://orbithere.com/images/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="https://orbithere.com/main.html">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
    <link rel="stylesheet" href="/orbit.css">
    <style>
        body { touch-action: manipulation; }   /* 나머지 기본값은 orbit.css */

        .bg-glow { z-index: 0; }   /* 앱 셸(.app)이 z-index:1이라 뒤로 밀지 않는다 */

        /* ===== 앱 셸 ===== */
        /* 폭 상한을 두고 가운데 정렬한다.
           울트라와이드(3440px)에서는 사이드바가 화면 왼쪽 끝에 붙고 본문은
           680px에 머물러, 둘 사이가 1200px 넘게 벌어지고 오른쪽이 통째로 비었다.
           셸 전체를 묶어 가운데로 보내면 사이드바와 본문이 하나의 창처럼 붙는다.
           1280px 미만 화면에서는 아무 영향이 없다. */
        .app { display: flex; min-height: 100vh; position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; }

        /* 사이드바 */
        .sidebar {
            width: 244px; flex-shrink: 0;
            position: sticky; top: 0; height: 100vh;
            display: flex; flex-direction: column;
            padding: 22px 16px;
            border-right: 1px solid rgba(255,159,67,0.1);
            background: rgba(15,23,42,0.55); backdrop-filter: blur(12px);
        }
        .side-logo {
            display: block; text-decoration: none;
            font-weight: 700; letter-spacing: 2px; color: var(--accent);
            font-size: 1.15rem; cursor: pointer; padding: 6px 12px 20px;
        }
        .side-nav { display: flex; flex-direction: column; gap: 4px; }
        .nav-item {
            display: flex; align-items: center; gap: 12px; width: 100%;
            padding: 12px 14px; border-radius: 12px; border: none; background: transparent;
            color: #94A3B8; font-family: 'Pretendard'; font-size: 14px; font-weight: 600;
            cursor: pointer; transition: all 0.15s; text-align: left;
        }
        .nav-item .ic { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
        .nav-item:hover { background: rgba(255,159,67,0.07); color: var(--text-main); }
        .nav-item.on { background: rgba(255,159,67,0.13); color: var(--accent); }

        /* 모바일 메뉴 버튼 / 스크림 — 데스크톱에서는 숨김 */
        .nav-toggle { display: none; }
        .nav-scrim { display: none; }

        /* 콘텐츠 */
        .content { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .topbar {
            display: flex; align-items: center; justify-content: space-between; gap: 16px;
            padding: 20px 32px; border-bottom: 1px solid rgba(255,159,67,0.08);
            position: sticky; top: 0; z-index: 10;
            background: rgba(15,23,42,0.7); backdrop-filter: blur(12px);
        }
        .panel-title { font-size: 1.3rem; font-weight: 700; margin: 0; line-height: 1.2; }
        .panel-title span { color: var(--accent); }
        .profile-chip {
            display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
            padding: 6px 14px 6px 7px; border-radius: 99px;
            background: rgba(255,159,67,0.08); border: 1px solid rgba(255,159,67,0.2);
            color: var(--accent); font-size: 13px; font-weight: 600; transition: all 0.15s;
            font-family: 'Pretendard'; white-space: nowrap;
        }
        .profile-chip:hover { background: rgba(255,159,67,0.14); border-color: var(--accent); }
        .profile-chip .pc-av {
            width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
            background: rgba(255,159,67,0.15); display: flex; align-items: center; justify-content: center; font-size: 13px;
        }

        /* 칩 옆 베타 안내 — 닉네임을 정하는 바로 그 버튼 옆에 둔다.
           색은 사이트에서 베타 표시에 쓰는 보라(광장의 β 배지)와 맞췄다.
           좁은 화면에서는 칩만 남기고 접는다 — 상단바가 두 줄로 밀리는 걸 막는다. */
        .topbar-right { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .beta-hint {
            font-size: 10.5px; line-height: 1.45; color: #64748B;
            text-align: right; white-space: nowrap;
        }
        .beta-hint b { color: #9F7AEA; font-weight: 700; }

        .panel-wrap { padding: 30px 32px 60px; flex: 1; }

        /* 본문 칼럼은 콘텐츠 영역 가운데로.
           푸터가 가운데 정렬이라 칼럼을 왼쪽에 붙여두면 둘의 중심이 어긋난다. */
        .embed-wrap { margin-left: auto; margin-right: auto; }
        .panel { display: none; }
        .panel.on { display: block; animation: panel-in 0.25s ease; }
        @keyframes panel-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        /* 글 남기기 iframe */
        .lounge-frame {
            width: 100%; height: calc(100vh - 152px);
            border: none; border-radius: 16px; background: transparent;
        }

        /* ===== 임베드 패널 (sky.html iframe) ===== */
        .embed-wrap { max-width: 680px; }
        .embed-frame {
            width: 100%; height: 620px;
            border: none; border-radius: 16px; background: transparent;
        }
        .embed-out {
            display: inline-block; margin-top: 10px; font-size: 12px;
            color: #64748B; text-decoration: none; transition: color 0.2s;
        }
        .embed-out:hover { color: var(--accent); }

        /* ===== 궤도 진입(닉네임) 대화상자 =====
           홈 패널을 없애면서 닉네임을 정할 자리가 사라졌다.
           상단바의 칩이 유일한 입구이므로, 칩을 누르면 여기서 정하도록 한다.
           (광장에서 "궤도 진입하러 가기"를 눌러도 이 상자가 열린다) */
        .join-back {
            position: fixed; inset: 0; z-index: 200;
            background: rgba(8,13,26,0.62); backdrop-filter: blur(3px);
            display: flex; align-items: center; justify-content: center; padding: 20px;
            animation: join-fade 0.15s ease;
        }
        @keyframes join-fade { from { opacity: 0; } }
        .join-box {
            width: 100%; max-width: 360px;
            background: #151E36; border: 1px solid rgba(255,159,67,0.2);
            border-radius: 18px; padding: 24px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            animation: join-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes join-in { from { opacity: 0; transform: translateY(10px) scale(0.98); } }
        .join-box h2 { font-size: 1.05rem; font-weight: 700; margin: 0 0 5px; color: var(--text-main); }
        .join-box h2 span { color: var(--accent); }
        .join-box .jb-sub { font-size: 11.5px; color: #64748B; line-height: 1.6; margin: 0 0 16px; }

        .join-form { display: flex; flex-direction: column; gap: 10px; }
        .join-form input {
            background: rgba(15,23,42,0.5);
            border: 1px solid rgba(255,159,67,0.3);
            border-radius: 12px; padding: 12px 15px;
            color: var(--text-main); font-family: 'Pretendard'; font-size: 14px;
            outline: none; transition: border-color 0.2s;
        }
        .join-form input:focus { border-color: var(--accent); }
        /* 모바일에서 16px 미만이면 iOS Safari가 포커스 순간 페이지를 자동 확대한다 */
        @media (max-width: 768px) { .join-form input { font-size: 16px; } }
        .join-form input.error { border-color: #FC8181; }
        .join-error { font-size: 11px; color: #FC8181; display: none; margin-top: -4px; }
        .btn-mint {
            background: var(--accent); color: #0F172A;
            border: none; border-radius: 12px; padding: 12px;
            font-weight: 700; cursor: pointer; transition: 0.2s; font-family: 'Pretendard';
            font-size: 13.5px;
        }
        .btn-mint:hover { opacity: 0.9; transform: scale(0.98); }
        .btn-outline {
            background: transparent; color: #94A3B8;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px; padding: 11px;
            font-weight: 600; cursor: pointer; transition: 0.2s;
            font-family: 'Pretendard'; font-size: 12.5px;
        }
        .btn-outline:hover { border-color: rgba(255,159,67,0.35); color: var(--accent); }
        .btn-leave {
            background: none; border: none; padding: 4px; margin-top: 2px;
            color: #64748B; font-family: 'Pretendard'; font-size: 11.5px;
            cursor: pointer; transition: color 0.2s;
        }
        .btn-leave:hover { color: #FC8181; }

        .joined-badge {
            display: flex; align-items: center; gap: 9px; padding: 11px 14px;
            background: rgba(255,159,67,0.08); border: 1px solid rgba(255,159,67,0.2);
            border-radius: 12px; font-size: 13.5px; color: var(--accent); font-weight: 700;
            margin-bottom: 12px;
        }

        .join-note {
            margin: 14px 0 0; padding: 10px 12px;
            background: rgba(159,122,234,0.07);
            border: 1px solid rgba(159,122,234,0.2);
            border-radius: 10px;
            font-size: 11px; line-height: 1.65; color: #94A3B8;
        }
        .join-note b { color: #9F7AEA; font-weight: 700; }

        /* ===== 공통 푸터 ===== */
        /* 사이드바 옆 본문 폭을 그대로 쓰는 푸터 — 공통 푸터의 720px 제한을 푼다 */
        .site-footer {
            max-width: none; margin-top: auto; padding: 24px 32px 30px;
            border-top: 1px solid rgba(255,159,67,0.08); text-align: center;
        }

        /* ===== 반응형 ===== */
        @media (max-width: 860px) {
            .app { flex-direction: column; }
            .sidebar {
                width: 100%; height: auto; position: sticky; top: 0; z-index: 40;
                flex-direction: row; align-items: center; justify-content: space-between; gap: 10px;
                padding: 10px 14px; overflow: visible;
            }
            .side-logo { padding: 6px 2px; }

            /* 메뉴 버튼 — 현재 탭을 보여주고, 누르면 탭 목록이 펼쳐짐 */
            .nav-toggle {
                display: inline-flex; align-items: center; gap: 8px;
                padding: 9px 12px 9px 14px; border-radius: 99px;
                border: 1px solid rgba(255,159,67,0.22); background: rgba(255,159,67,0.09);
                color: var(--accent); font-family: 'Pretendard'; font-size: 13.5px; font-weight: 700;
                cursor: pointer; transition: background 0.15s, border-color 0.15s;
                max-width: 62vw;
            }
            .nav-toggle:active { background: rgba(255,159,67,0.16); }
            .nav-toggle .nt-ic { font-size: 15px; flex-shrink: 0; }
            .nav-toggle .nt-lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .nav-toggle .nt-arrow {
                width: 9px; height: 9px; flex-shrink: 0; margin-left: 1px;
                border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
                transform: rotate(45deg) translate(-2px, -2px);
                transition: transform 0.25s ease;
            }
            .sidebar.open .nav-toggle { background: rgba(255,159,67,0.16); border-color: var(--accent); }
            .sidebar.open .nav-toggle .nt-arrow { transform: rotate(-135deg) translate(-2px, -2px); }

            /* 펼쳐지는 탭 목록 */
            .side-nav {
                position: absolute; top: calc(100% - 4px); left: 10px; right: 10px;
                flex-direction: column; gap: 4px; padding: 8px;
                border-radius: 18px;
                background: #151E36; backdrop-filter: blur(14px);
                border: 1px solid rgba(255,159,67,0.18);
                box-shadow: 0 18px 40px rgba(0,0,0,0.45);
                opacity: 0; visibility: hidden; pointer-events: none;
                transform: translateY(-10px) scale(0.98); transform-origin: top right;
                transition: opacity 0.18s ease, transform 0.22s ease, visibility 0.22s;
            }
            .sidebar.open .side-nav {
                opacity: 1; visibility: visible; pointer-events: auto;
                transform: translateY(0) scale(1);
            }
            .nav-item { padding: 13px 14px; font-size: 14.5px; white-space: nowrap; }
            .sidebar.open .nav-item { animation: nav-drop 0.28s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
            .sidebar.open .nav-item:nth-child(1) { animation-delay: 0.02s; }
            .sidebar.open .nav-item:nth-child(2) { animation-delay: 0.05s; }
            .sidebar.open .nav-item:nth-child(3) { animation-delay: 0.08s; }
            .sidebar.open .nav-item:nth-child(4) { animation-delay: 0.11s; }
            .sidebar.open .nav-item:nth-child(5) { animation-delay: 0.14s; }
            .sidebar.open .nav-item:nth-child(6) { animation-delay: 0.17s; }
            .sidebar.open .nav-item:nth-child(n+7) { animation-delay: 0.2s; }
            @keyframes nav-drop {
                from { opacity: 0; transform: translateY(-12px); }
                to   { opacity: 1; transform: translateY(0); }
            }

            /* 바깥 영역 탭하면 닫힘 */
            .nav-scrim {
                display: block; position: fixed; inset: 0; z-index: 39;
                background: rgba(8, 13, 26, 0.5);
                opacity: 0; visibility: hidden; transition: opacity 0.2s ease, visibility 0.2s;
            }
            .nav-scrim.on { opacity: 1; visibility: visible; }

            .topbar { padding: 16px 18px; }
            .panel-wrap { padding: 20px 18px 50px; }
            .lounge-frame { height: calc(100vh - 132px); }
            /* 베타 안내는 칩 옆에 두면 상단바가 두 줄로 밀린다 — 좁은 화면에서는 접는다.
               (같은 내용을 진입 대화상자 안에서 다시 보여주므로 정보가 사라지진 않는다) */
            .beta-hint { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
            .sidebar.open .nav-item { animation: none; }
            .side-nav, .nav-scrim, .nav-toggle .nt-arrow { transition-duration: 0.01ms; }
        }

        ::selection { background-color: #4FD1C5; color: #0F172A; }
    </style>
    <script src="effects.js" defer></script>
</head>
<body>
    <div class="bg-glow"></div>

    <div class="app">
        <!-- 사이드바 -->
        <aside class="sidebar">
            <a class="side-logo" href="index.html">ORBIT.</a>
            <button class="nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="sideNav" aria-label="메뉴 열기">
                <span class="nt-ic" id="navToggleIc">🔭</span>
                <span class="nt-lbl" id="navToggleLbl">밤하늘 달력</span>
                <span class="nt-arrow" aria-hidden="true"></span>
            </button>
            <nav class="side-nav" id="sideNav">
                <button class="nav-item on" data-panel="sky"><span class="ic">🔭</span><span class="lbl">밤하늘 달력</span></button>
                <button class="nav-item" data-panel="lounge"><span class="ic">💬</span><span class="lbl">글 남기기</span></button>
            </nav>
        </aside>
        <div class="nav-scrim" id="navScrim"></div>

        <!-- 콘텐츠 -->
        <div class="content">
            <div class="topbar">
                <h1 class="panel-title" id="panelTitle">밤하늘 <span>달력</span></h1>
                <div class="topbar-right">
                    <span class="beta-hint">
                        <b>β 베타</b> — 닉네임은 이 기기에만<br>저장돼요. 선점되지 않습니다.
                    </span>
                    <button class="profile-chip" id="profileChip" type="button">
                        <span class="pc-av">🦦</span><span id="profileChipText">궤도 진입하기</span>
                    </button>
                </div>
            </div>

            <div class="panel-wrap">
                <!-- 밤하늘 달력 — 첫 화면 -->
                <section class="panel on" id="panel-sky">
                    <div class="embed-wrap">
                        <iframe class="embed-frame" id="skyFrame" title="밤하늘 달력 — 유성우 · 일식 · 월식 일정" data-src="sky.html?embed=1"></iframe>
                        <a class="embed-out" href="sky.html">전체 화면으로 열기 · 관측 방법과 FAQ 보기 →</a>
                    </div>
                </section>

                <!-- 글 남기기 -->
                <section class="panel" id="panel-lounge">
                    <iframe class="lounge-frame" id="loungeFrame" title="글 남기기" data-src="lounge.html?embed=1"></iframe>
                </section>
            </div>

            <footer class="site-footer">
                <div class="foot-links">
                    <a href="sky.html">밤하늘 달력</a>
                    <a href="lounge.html">글 남기기</a>
                    <a href="terms.html">이용약관</a>
                    <a href="privacy.html">개인정보처리방침</a>
                </div>
                <div class="foot-sign">
                    © 2026 Orbit · Made with
                    <svg class="foot-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M 50 15 L 62 34 L 83 39 L 69 56 L 71 78 L 50 70 L 29 78 L 31 56 L 17 39 L 38 34 Z" fill="#FF9F43" stroke="#FF9F43" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/></svg>
                    in orbit
                </div>
            </footer>
        </div>
    </div>

    <!-- 궤도 진입(닉네임) 대화상자 — 기본은 닫힘. JS가 열고 닫는다. -->
    <div class="join-back" id="joinBack" style="display:none;">
        <div class="join-box" role="dialog" aria-modal="true" aria-labelledby="joinTitle">
            <h2 id="joinTitle">궤도 <span>진입하기</span></h2>
            <p class="jb-sub" id="joinSub">닉네임만 정하면 바로 글을 남길 수 있어요. 가입도 로그인도 없습니다.</p>

            <!-- 미진입 -->
            <div id="joinNew">
                <div class="join-form">
                    <input type="text" id="nicknameInput" placeholder="닉네임을 입력하세요" maxlength="12" autocomplete="off">
                    <div class="join-error" id="joinError"></div>
                    <button class="btn-mint" id="joinBtn" type="button">궤도 진입</button>
                </div>
            </div>

            <!-- 진입 완료 -->
            <div id="joinDone" style="display:none;">
                <div class="joined-badge">
                    <span id="joinedAvatar">🌟</span>
                    <span id="joinedNickname">—</span>
                </div>
                <button class="btn-outline" id="btnRename" type="button" style="width:100%;">닉네임 바꾸기</button>
                <button class="btn-leave" id="btnLeave" type="button" style="width:100%;">이 기기에서 닉네임 지우기</button>
            </div>

            <p class="join-note">
                <b>β 베타</b> — 닉네임은 아직 먼저 쓴 사람이 임자가 되는 방식이 아니에요.
                같은 이름을 다른 분이 쓸 수도 있습니다.
                대신 내가 남긴 궤적과 답은 <b>이 기기에서만</b> 지울 수 있어요.
            </p>
            <button class="btn-outline" id="joinClose" type="button" style="width:100%;margin-top:12px;">닫기</button>
        </div>
    </div>

    <script>
    // ===== 패널 전환 =====
    (function(){
        var TITLES = {
            sky:    '밤하늘 <span>달력</span>',
            lounge: '글 <span>남기기</span>'
        };
        var DEFAULT_PANEL = 'sky';
        var loungeLoaded = false, skyLoaded = false;

        // ===== 모바일 탭 메뉴 (버튼 → 탭 목록 펼치기) =====
        var sidebar   = document.querySelector('.sidebar');
        var navToggle = document.getElementById('navToggle');
        var navScrim  = document.getElementById('navScrim');
        function setMenu(open){
            sidebar.classList.toggle('open', open);
            navScrim.classList.toggle('on', open);
            navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            navToggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
        }
        navToggle.addEventListener('click', function(){
            setMenu(!sidebar.classList.contains('open'));
        });
        navScrim.addEventListener('click', function(){ setMenu(false); });
        document.addEventListener('keydown', function(e){
            if(e.key === 'Escape' && sidebar.classList.contains('open')) setMenu(false);
        });
        window.addEventListener('resize', function(){
            if(window.innerWidth > 860 && sidebar.classList.contains('open')) setMenu(false);
        });

        function switchPanel(name){
            if(!TITLES[name]) name = DEFAULT_PANEL;
            document.querySelectorAll('.nav-item').forEach(function(b){
                var on = b.getAttribute('data-panel') === name;
                b.classList.toggle('on', on);
                if(on){
                    document.getElementById('navToggleIc').textContent  = b.querySelector('.ic').textContent;
                    document.getElementById('navToggleLbl').textContent = b.querySelector('.lbl').textContent;
                }
            });
            setMenu(false);
            document.querySelectorAll('.panel').forEach(function(p){
                p.classList.toggle('on', p.id === 'panel-' + name);
            });
            document.getElementById('panelTitle').innerHTML = TITLES[name];
            // 처음 열 때만 iframe 로드 (지연 로딩)
            if(name === 'lounge' && !loungeLoaded){
                var fr = document.getElementById('loungeFrame');
                fr.src = fr.getAttribute('data-src');
                loungeLoaded = true;
            }
            if(name === 'sky' && !skyLoaded){
                var sf = document.getElementById('skyFrame');
                sf.src = sf.getAttribute('data-src');
                skyLoaded = true;
            }
            if(location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
        }
        document.getElementById('sideNav').addEventListener('click', function(e){
            var btn = e.target.closest('.nav-item');
            if(!btn) return;
            switchPanel(btn.getAttribute('data-panel'));
        });
        window.addEventListener('hashchange', function(){
            // #join은 패널이 아니라 대화상자를 여는 신호다 (광장에서 단독 페이지로 넘어올 때)
            if(location.hash === '#join'){ openJoin(); return; }
            switchPanel(location.hash.slice(1));
        });

        // 임베드된 광장(iframe)에서 보내는 요청 수신
        window.addEventListener('message', function(ev){
            if(ev.origin !== window.location.origin) return;
            // 예전 이름(goHome)도 같이 받는다 — 캐시에 남은 옛 lounge.html이
            // 아직 그 이름으로 보내고 있어도 진입 대화상자가 열리게.
            if(ev.data && (ev.data.orbit === 'join' || ev.data.orbit === 'goHome')){
                openJoin();
            }
            // 임베드된 페이지는 탭·필터에 따라 높이가 변한다.
            // 고정 높이로 두면 iframe 안에 스크롤바가 따로 생기므로 콘텐츠에 맞춰 늘려준다.
            // 상한을 두는 건 잘못된 값이 와도 페이지가 끝없이 길어지지 않게 하기 위함이다.
            if(ev.data && ev.data.orbit === 'skyHeight'){
                var h = parseInt(ev.data.height, 10);
                if(h > 0 && h < 8000) document.getElementById('skyFrame').style.height = h + 'px';
            }
        });

        // ===== 궤도 진입(닉네임) 대화상자 =====
        // 홈 패널이 없어졌으므로 닉네임을 정하는 자리는 여기 하나뿐이다.
        var EMOJIS = ['🌟','⭐','🪐','🌙','☄️','🔭','🛸','💫','🌌','✨'];
        function avatarOf(nick){ return EMOJIS[nick.charCodeAt(0) % EMOJIS.length]; }

        var back  = document.getElementById('joinBack');
        var input = document.getElementById('nicknameInput');
        var errEl = document.getElementById('joinError');

        function nickname(){ return localStorage.getItem('orbit_nickname'); }

        // 상단바 칩 — 진입 여부를 그대로 보여준다
        function syncChip(){
            var n = nickname();
            document.getElementById('profileChipText').textContent = n || '궤도 진입하기';
            document.querySelector('#profileChip .pc-av').textContent = n ? avatarOf(n) : '🦦';
        }

        function openJoin(){
            var n = nickname();
            document.getElementById('joinNew').style.display  = n ? 'none' : '';
            document.getElementById('joinDone').style.display = n ? '' : 'none';
            document.getElementById('joinTitle').innerHTML = n
                ? '궤도에 <span>있어요</span>' : '궤도 <span>진입하기</span>';
            document.getElementById('joinSub').textContent = n
                ? '이 기기는 아래 닉네임으로 글을 남기고 있어요.'
                : '닉네임만 정하면 바로 글을 남길 수 있어요. 가입도 로그인도 없습니다.';
            if(n){
                document.getElementById('joinedNickname').textContent = n;
                document.getElementById('joinedAvatar').textContent = avatarOf(n);
            } else {
                input.value = '';
                input.classList.remove('error');
                errEl.style.display = 'none';
            }
            back.style.display = '';
            if(!n) setTimeout(function(){ input.focus(); }, 50);
            document.addEventListener('keydown', onEsc);
        }
        function closeJoin(){
            back.style.display = 'none';
            document.removeEventListener('keydown', onEsc);
            // 대화상자를 여는 신호로 쓴 해시를 남겨두면 새로고침 때 다시 열린다
            if(location.hash === '#join') history.replaceState(null, '', '#' + DEFAULT_PANEL);
        }
        function onEsc(e){ if(e.key === 'Escape') closeJoin(); }

        back.addEventListener('click', function(e){ if(e.target === back) closeJoin(); });
        document.getElementById('joinClose').addEventListener('click', closeJoin);
        document.getElementById('profileChip').addEventListener('click', openJoin);

        function showError(msg){
            input.classList.add('error');
            errEl.textContent = msg;
            errEl.style.display = 'block';
            input.focus();
        }

        document.getElementById('joinBtn').addEventListener('click', function(){
            var val = input.value.trim();
            input.classList.remove('error');
            errEl.style.display = 'none';

            // 서버(posts.nick check 제약)가 2~12자를 요구하므로 여기서 같은 기준으로 걸러준다
            if(!val)            return showError('닉네임을 입력해주세요');
            if(val.length < 2)  return showError('닉네임은 2자 이상이어야 해요');
            if(val.length > 12) return showError('닉네임은 12자 이하여야 해요');
            if(/[<>\"\'\/\\]/.test(val)) return showError('사용할 수 없는 문자가 포함되어 있어요');

            localStorage.setItem('orbit_nickname', val);
            localStorage.setItem('orbit_joindate', new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'}));
            localStorage.setItem('orbit_jointime', Date.now());
            syncChip();
            closeJoin();
            // 광장이 이미 로드돼 있으면 미진입 상태의 글쓰기 카드를 들고 있다.
            // 새 닉네임을 반영하려면 다시 읽혀야 하므로 프레임을 새로 띄운다.
            reloadLounge();
            switchPanel('lounge');
        });
        input.addEventListener('keydown', function(e){
            if(e.key === 'Enter') document.getElementById('joinBtn').click();
        });

        document.getElementById('btnRename').addEventListener('click', function(){
            localStorage.removeItem('orbit_nickname');
            syncChip();
            openJoin();
        });
        document.getElementById('btnLeave').addEventListener('click', function(){
            if(!confirm('이 기기에서 닉네임을 지울까요?\n이미 남긴 글은 그대로 남고, 지울 권한도 이 기기에 남아 있어요.')) return;
            localStorage.removeItem('orbit_nickname');
            localStorage.removeItem('orbit_joindate');
            localStorage.removeItem('orbit_jointime');
            syncChip();
            closeJoin();
            reloadLounge();
        });

        // 광장 iframe을 아직 안 열었으면 건드리지 않는다 — 열 때 어차피 새로 읽는다
        function reloadLounge(){
            if(!loungeLoaded) return;
            var fr = document.getElementById('loungeFrame');
            fr.src = fr.getAttribute('data-src');
        }

        // ===== 초기 상태 =====
        syncChip();
        if(location.hash === '#join'){
            switchPanel(DEFAULT_PANEL);
            openJoin();
        } else {
            switchPanel((location.hash || '#' + DEFAULT_PANEL).slice(1));
        }
    })();
    </script>
</body>
</html>
````


## `sky.html`

> 792줄 · 46916바이트

밤하늘 달력 — 첫 화면이자 검색 유입 창구. 위쪽은 다음 현상 카운트다운·오늘의 달·필터·타임라인, 아래쪽은 SEO 본문과 FAQ. 달의 위상·밝기·월령은 Meeus 알고리즘으로 직접 계산하고(moonInfo), 이벤트 일정 14건은 EVENTS 배열에 하드코딩돼 있다(2026-08 ~ 2027-08). head에 JSON-LD 두 개(WebApplication·FAQPage).

````html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>밤하늘 달력 — 유성우 · 일식 · 월식 · 슈퍼문 일정 | Orbit</title>
    <meta name="description" content="다음 유성우는 언제일까요? 페르세우스자리 유성우부터 쌍둥이자리 유성우, 개기일식과 슈퍼문까지. 극대 시각과 달빛 방해까지 계산해 관측 조건을 알려주는 밤하늘 달력.">
    <meta name="theme-color" content="#0F172A">
    <link rel="canonical" href="https://orbithere.com/sky.html">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Orbit">
    <meta property="og:title" content="밤하늘 달력 — 유성우 · 일식 · 월식 · 슈퍼문 일정">
    <meta property="og:description" content="다음 천문 현상까지 남은 시간, 오늘의 달, 그리고 달빛 방해까지 계산한 관측 조건. 궤도에서 내려다본 밤하늘 일정표.">
    <meta property="og:image" content="https://orbithere.com/images/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="https://orbithere.com/sky.html">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Orbit 밤하늘 달력",
      "url": "https://orbithere.com/sky.html",
      "applicationCategory": "ReferenceApplication",
      "operatingSystem": "All",
      "inLanguage": "ko",
      "description": "유성우·일식·월식·슈퍼문 일정과 관측 조건을 보여주는 밤하늘 달력.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "KRW" }
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "유성우는 극대 시각에 봐야 하나요?",
          "acceptedAnswer": { "@type": "Answer", "text": "극대 시각이 낮이면 그 시각에는 볼 수 없습니다. 유성우는 극대 전후 하루 이틀 동안 이어지므로, 극대에 가장 가까운 '밤'을 고르면 됩니다. 밤하늘 달력은 극대 시각과 별개로 실제 관측하기 좋은 밤을 따로 알려드립니다." }
        },
        {
          "@type": "Question",
          "name": "관측 조건은 어떻게 계산하나요?",
          "acceptedAnswer": { "@type": "Answer", "text": "관측일 밤의 달 조도를 천문 계산으로 구해 등급을 매깁니다. 달이 밝으면 어두운 유성이 묻혀서 실제로 보이는 개수가 크게 줄기 때문입니다. 다만 달이 뜨고 지는 시각과 그날의 날씨는 반영하지 않으므로 참고용으로 봐주세요." }
        },
        {
          "@type": "Question",
          "name": "ZHR이 시간당 100개면 100개를 볼 수 있나요?",
          "acceptedAnswer": { "@type": "Answer", "text": "아닙니다. ZHR은 하늘이 완벽히 어둡고 복사점이 머리 꼭대기에 있을 때를 가정한 이론값입니다. 실제 도심에서는 그 몇 분의 일, 어두운 시골에서도 절반 정도를 보는 경우가 많습니다." }
        },
        {
          "@type": "Question",
          "name": "관측에 망원경이 필요한가요?",
          "acceptedAnswer": { "@type": "Answer", "text": "유성우는 맨눈이 가장 좋습니다. 망원경이나 쌍안경은 시야를 좁혀서 오히려 불리합니다. 하늘이 넓게 트인 어두운 곳에 누워 하늘 전체를 보는 것이 가장 좋은 방법입니다." }
        },
        {
          "@type": "Question",
          "name": "한국에서 안 보이는 현상도 있나요?",
          "acceptedAnswer": { "@type": "Answer", "text": "있습니다. 일식과 월식은 지구 위 특정 지역에서만 보입니다. 예를 들어 2026년 8월 12일 개기일식은 그린란드·아이슬란드·스페인에서 보이고 한국은 밤이라 볼 수 없습니다. 밤하늘 달력은 각 현상마다 국내 관측 가능 여부를 표시합니다." }
        }
      ]
    }
    </script>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
    <link rel="stylesheet" href="/orbit.css">
    <style>
        :root { --mint: #4FD1C5; }   /* 나머지 색은 orbit.css */
        body { touch-action: manipulation; }   /* 나머지 기본값은 orbit.css */


        .container { max-width: 720px; margin: 130px auto 80px; padding: 0 20px; }

        /* 히어로·SEO 본문·notice·cta-lounge 공통 스타일은 orbit.css */

        .card-tag {
            display: inline-flex; align-items: center; justify-content: center;
            height: 24px; padding: 0 11px; line-height: 1;
            font-size: 11px; font-weight: 600;
            color: var(--accent); background: rgba(255,159,67,0.1);
            border-radius: 99px; margin-bottom: 12px;
        }

        /* ===== 다음 현상 카운트다운 ===== */
        .next-card {
            background: var(--card-bg);
            border: 1px solid rgba(255,159,67,0.15);
            border-radius: 20px; padding: 26px; position: relative; overflow: hidden;
        }
        .next-card::before {
            content:''; position:absolute; top:-70px; right:-70px; width:230px; height:230px;
            background:radial-gradient(circle,rgba(255,159,67,0.07) 0%,transparent 70%); pointer-events:none;
        }
        .nx-emoji { font-size: 34px; line-height: 1; }
        .nx-head { display: flex; align-items: center; gap: 12px; }
        .nx-name { font-size: 1.15rem; font-weight: 700; }
        .nx-when { font-size: 11.5px; color: #64748B; margin-top: 3px; }
        .dday-row { display: flex; align-items: baseline; gap: 10px; margin: 18px 0 4px; flex-wrap: wrap; }
        .dday { font-size: 2.6rem; font-weight: 700; color: var(--accent); line-height: 1; letter-spacing: -0.02em; }
        .dday-sub { font-size: 13px; color: #94A3B8; }
        .cd-units { display: flex; gap: 7px; margin-top: 14px; flex-wrap: wrap; }
        .cd-unit {
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
            border-radius: 11px; padding: 9px 13px; text-align: center; min-width: 62px;
        }
        .cd-unit b { display: block; font-size: 1.1rem; color: var(--text-main); font-weight: 700; font-variant-numeric: tabular-nums; }
        .cd-unit span { font-size: 10px; color: #64748B; }
        .nx-note {
            margin-top: 16px; padding: 13px 15px; border-radius: 12px;
            background: rgba(79,209,197,0.07); border: 1px solid rgba(79,209,197,0.2);
            font-size: 12.5px; color: #A5B4C4; line-height: 1.7;
        }
        .nx-note strong { color: var(--mint); font-weight: 700; }

        /* ===== 오늘의 달 ===== */
        .moon-card {
            margin-top: 16px; display: flex; align-items: center; gap: 20px;
            background: var(--card-bg); border: 1px solid rgba(255,159,67,0.15);
            border-radius: 20px; padding: 22px 26px;
        }
        .moon-vis { flex-shrink: 0; }
        .moon-meta .mm-name { font-size: 1.05rem; font-weight: 700; margin-bottom: 5px; }
        .moon-meta .mm-name span { color: var(--accent); }
        .moon-meta .mm-line { font-size: 12.5px; color: #94A3B8; line-height: 1.75; }
        .moon-meta .mm-line b { color: #CBD5E1; font-weight: 600; font-variant-numeric: tabular-nums; }

        /* ===== 필터 ===== */
        .filter-row { display: flex; gap: 8px; margin: 30px 0 14px; flex-wrap: wrap; }
        .fbtn {
            display: inline-flex; align-items: center; justify-content: center;
            height: 30px; padding: 0 16px; line-height: 1;
            font-size: 12px; border-radius: 99px;
            border: 1.5px solid rgba(255,159,67,0.25); background: transparent;
            cursor: pointer; color: #94A3B8; transition: all 0.2s;
            font-family: 'Pretendard'; font-weight: 500;
        }
        .fbtn:hover { color: var(--text-main); border-color: rgba(255,159,67,0.45); }
        .fbtn.on { background: var(--accent); border-color: var(--accent); color: #0F172A; font-weight: 700; }

        /* ===== 타임라인 ===== */
        .timeline { display: flex; flex-direction: column; gap: 10px; }
        .ev {
            background: var(--card-bg); border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px; padding: 16px 18px; cursor: pointer;
            transition: border-color 0.2s, transform 0.2s;
        }
        .ev:hover { border-color: rgba(255,159,67,0.35); transform: translateY(-1px); }
        .ev:focus-visible { border-color: rgba(255,159,67,0.5); outline: none; }
        .ev.open { border-color: rgba(255,159,67,0.4); }
        .ev-top { display: flex; align-items: center; gap: 13px; }
        .ev-ic { font-size: 22px; line-height: 1; flex-shrink: 0; width: 26px; text-align: center; }
        .ev-mid { flex: 1; min-width: 0; }
        .ev-name { font-size: 14.5px; font-weight: 600; }
        .ev-date { font-size: 11.5px; color: #64748B; margin-top: 2px; }
        .ev-dday {
            flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
            height: 25px; padding: 0 12px; line-height: 1;
            font-size: 12px; font-weight: 700; color: var(--accent);
            background: rgba(255,159,67,0.1); border-radius: 99px;
            font-variant-numeric: tabular-nums;
        }
        .ev-dday.past { color: #64748B; background: rgba(255,255,255,0.03); }

        .badges { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
        /* 알약 배지 — 높이를 고정하고 flex로 가운데 맞춘다.
           inline 요소로 두면 상하 패딩이 줄 높이에 반영되지 않아 글자가
           폰트 baseline을 따라 위로 뜨고, 이모지가 든 배지만 박스가 커진다. */
        .bdg {
            display: inline-flex; align-items: center; justify-content: center;
            height: 23px; padding: 0 10px; line-height: 1;
            font-size: 10.5px; font-weight: 600; border-radius: 99px;
            border: 1px solid transparent; white-space: nowrap;
        }
        /* 이모지가 줄 높이를 밀어 올리지 않도록 글자와 같은 크기로 묶는다 */
        .bdg .bi { font-size: 11px; line-height: 1; margin-right: 3px; }
        .bdg.best  { color: #4FD1C5; background: rgba(79,209,197,0.1);  border-color: rgba(79,209,197,0.3); }
        .bdg.good  { color: #A3D977; background: rgba(163,217,119,0.1); border-color: rgba(163,217,119,0.28); }
        .bdg.fair  { color: #FFB74D; background: rgba(255,183,77,0.1);  border-color: rgba(255,183,77,0.28); }
        .bdg.poor  { color: #F87171; background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.28); }
        .bdg.kr    { color: #94A3B8; background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.09); }
        .bdg.nokr  { color: #64748B; background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.07); }
        .bdg.zhr   { color: #94A3B8; background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.09); font-variant-numeric: tabular-nums; }

        .ev-body { display: none; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); }
        .ev.open .ev-body { display: block; animation: rise 0.25s ease; }
        @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .ev-desc { font-size: 13px; color: #94A3B8; line-height: 1.8; margin: 0 0 12px; }
        .ev-rows { display: flex; flex-direction: column; gap: 8px; }
        .ev-row {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 10px 12px; border-radius: 10px;
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
        }
        .ev-row .rl { font-size: 11px; font-weight: 700; color: var(--accent); flex-shrink: 0; width: 74px; }
        .ev-row .rv { font-size: 12.5px; color: #94A3B8; line-height: 1.65; flex: 1; }

        /* SEO 본문·notice·cta-lounge 공통 스타일은 orbit.css — 이 페이지 고유분만 */
        .notice a { color: #94A3B8; }

        @media (max-width: 768px) {
            .container { margin-top: 110px; }
            .dday { font-size: 2.1rem; }
            .moon-card { gap: 16px; padding: 20px; }
        }
        @media (max-width: 420px) {
            .moon-card { flex-direction: column; align-items: flex-start; }
            .ev-row { flex-direction: column; gap: 3px; }
            .ev-row .rl { width: auto; }
        }

        ::selection { background-color: #4FD1C5; color: #0F172A; }

        /* ===== 공통 푸터 ===== */
        .site-footer { margin: 0 auto; }   /* 임베드용 — 위 여백 없이 */

        /* 메인 패널에 iframe으로 임베드될 때 */
        .embed nav { display: none; }
        .embed .container { margin: 0 auto; padding: 0; max-width: 680px; }
        .embed .hero, .embed .seo-content, .embed .site-footer { display: none; }
    </style>
    <script>if(new URLSearchParams(location.search).get('embed'))document.documentElement.classList.add('embed');</script>
    <script src="effects.js" defer></script>
</head>
<body>
    <div class="bg-glow"></div>

    <nav class="site-topbar">
        <a class="logo" href="index.html">ORBIT.</a>
        <button class="nav-back" onclick="location.href='main.html'">← 커뮤니티 홈</button>
    </nav>

    <main class="container">
        <div class="hero">
            <h1><strong>밤하늘 달력</strong> — 다음 우주쇼는 언제?</h1>
            <p>유성우, 일식과 월식, 그리고 가장 큰 보름달까지. 다음 천문 현상까지 남은 시간과 함께, 그날 밤 달빛이 얼마나 방해할지까지 계산해서 관측 조건을 알려드립니다. 궤도에서 내려다본 밤하늘 일정표.</p>
        </div>

        <!-- 다음 현상 카운트다운 -->
        <section class="next-card">
            <div style="display:flex;align-items:center;gap:10px;">
                <span class="card-tag" style="margin-bottom:0;">🔭 다음 천문 현상</span>
                <span style="font-size:10px;color:#64748B;">한국 표준시(KST) 기준</span>
            </div>
            <div class="nx-head" style="margin-top:14px;">
                <div class="nx-emoji" id="nxEmoji">✨</div>
                <div>
                    <div class="nx-name" id="nxName">불러오는 중…</div>
                    <div class="nx-when" id="nxWhen"></div>
                </div>
            </div>
            <div class="dday-row">
                <div class="dday" id="nxDday">D-</div>
                <div class="dday-sub" id="nxDdaySub"></div>
            </div>
            <div class="cd-units" id="nxUnits"></div>
            <div class="nx-note" id="nxNote"></div>
        </section>

        <!-- 오늘의 달 -->
        <section class="moon-card">
            <div class="moon-vis" id="moonVis"></div>
            <div class="moon-meta">
                <div class="mm-name">오늘의 달 — <span id="mmPhase">…</span></div>
                <div class="mm-line">
                    월령 <b id="mmAge">–</b> · 밝기 <b id="mmIllum">–</b><br>
                    <span id="mmHint" style="color:#64748B;"></span>
                </div>
            </div>
        </section>

        <!-- 필터 -->
        <div class="filter-row" id="filterRow">
            <button class="fbtn on" data-f="all">전체</button>
            <button class="fbtn" data-f="meteor">☄️ 유성우</button>
            <button class="fbtn" data-f="moon">🌕 달</button>
            <button class="fbtn" data-f="eclipse">🌑 일식 · 월식</button>
            <button class="fbtn" data-f="kr">🇰🇷 국내 관측 가능</button>
        </div>

        <div class="timeline" id="timeline"></div>

        <!-- SEO 본문 -->
        <section class="seo-content">
            <h2>유성우, 언제 어떻게 봐야 잘 보일까?</h2>
            <p>유성우 소식은 매년 뉴스에 나오지만, 정작 <strong>"그래서 오늘 밤 몇 시에 어디를 보면 되냐"</strong>에 답해주는 곳은 의외로 드뭅니다. 밤하늘 달력은 그 한 가지에 집중합니다.</p>

            <h3>1. 극대 시각보다 '극대에 가까운 밤'이 중요합니다</h3>
            <p>유성우에는 가장 많이 떨어지는 <strong>극대 시각</strong>이 있습니다. 그런데 이 시각이 한국 기준 대낮이면 그 순간에는 아무것도 볼 수 없습니다. 다행히 유성우는 극대 앞뒤로 하루 이틀 이어지기 때문에, 극대에 가장 가까운 밤을 고르면 됩니다. 그래서 이 페이지는 극대 시각과 <strong>실제 관측하기 좋은 밤</strong>을 따로 표시합니다.</p>

            <h3>2. 최대의 적은 구름이 아니라 달빛입니다</h3>
            <p>보름달이 떠 있는 밤에는 하늘 전체가 밝아져서 어두운 유성이 전부 묻혀버립니다. 시간당 100개가 떨어지는 유성우라도 보름달이 겹치면 체감으로는 몇 개밖에 못 봅니다. 반대로 <strong>신월(그믐) 근처면 같은 유성우도 완전히 다른 경험</strong>이 됩니다. 이 페이지는 각 관측일 밤의 달 밝기를 천문 계산으로 구해 관측 조건 등급을 매깁니다.</p>

            <h3>3. 새벽이 저녁보다 유리합니다</h3>
            <p>자정을 넘기면 지구의 자전 때문에 관측자가 지구의 '진행 방향' 쪽을 향하게 됩니다. 달리는 차의 앞유리에 빗방울이 더 많이 부딪히는 것과 같은 이치로, <strong>새벽 시간대에 유성이 더 많이 보입니다.</strong> 대체로 자정 이후부터 동트기 전까지가 가장 좋습니다.</p>

            <h3>4. 준비물은 맨눈, 그리고 시간</h3>
            <p>망원경이나 쌍안경은 오히려 <strong>방해가 됩니다.</strong> 시야를 좁혀버리기 때문입니다. 유성우는 하늘 전체에서 나타나므로 맨눈으로 넓게 보는 것이 정답입니다. 눈이 어둠에 적응하는 데 <strong>20~30분</strong>이 걸리니, 그동안 휴대폰 화면을 보지 않는 것이 중요합니다. 돗자리를 깔고 누우면 목도 안 아프고 시야도 가장 넓어집니다.</p>

            <h3>5. 복사점을 정면으로 볼 필요는 없습니다</h3>
            <p>유성우의 이름은 유성이 뻗어 나오는 <strong>복사점</strong>이 있는 별자리에서 따옵니다. 하지만 복사점만 뚫어져라 볼 필요는 없습니다. 오히려 복사점에서 조금 떨어진 하늘에서 유성의 꼬리가 더 길게 보입니다. 복사점 방향을 대략 알고, 하늘 전체를 훑는 것이 좋습니다.</p>

            <h2>ZHR이 뭔가요?</h2>
            <p>ZHR(천정시간율)은 <strong>하늘이 완벽하게 어둡고 복사점이 정확히 머리 꼭대기에 있을 때</strong> 한 사람이 한 시간에 볼 수 있는 유성 개수의 이론값입니다. 즉 현실에서는 거의 도달할 수 없는 최댓값입니다.</p>
            <p>도심에서는 ZHR의 10분의 1 이하, 불빛이 적은 시골이라도 절반 정도를 보게 되는 경우가 많습니다. ZHR 100인 유성우라면 어두운 곳에서 <strong>시간당 20~50개 정도</strong>를 기대하는 것이 현실적입니다. 숫자가 작다고 실망할 필요는 없습니다. 하나만 봐도 충분히 좋으니까요.</p>

            <h2>일식과 월식은 왜 한국에서 못 보는 경우가 있나요?</h2>
            <p>유성우는 지구의 밤인 곳이면 어디서나 볼 수 있지만, <strong>일식과 월식은 다릅니다.</strong></p>
            <p><strong>일식</strong>은 달의 그림자가 지구 표면에 드리우는 현상이라, 그 그림자가 지나가는 좁은 길 위에 있어야만 보입니다. <strong>월식</strong>은 달이 지구 그림자에 들어가는 현상이라 지구 밤쪽 절반에서 볼 수 있지만, 그 시각에 우리나라가 낮이면 달이 지평선 아래에 있어 볼 수 없습니다.</p>
            <p>그래서 밤하늘 달력은 현상마다 <strong>국내에서 볼 수 있는지 여부</strong>를 반드시 함께 표시합니다. 해외에서만 보이는 현상도 목록에 남겨두는 이유는, 그것대로 알아두면 재미있고 여행 계획의 이유가 되기도 하기 때문입니다.</p>

            <div class="notice">
                <strong style="color:#94A3B8;">데이터 안내 ·</strong>
                일정과 극대 시각은 한국천문연구원(KASI)과 국제유성기구(IMO)가 공개한 자료를 기준으로 정리했습니다.
                달의 위상·밝기·월령은 이 페이지에서 천문 계산식으로 직접 계산해 표시합니다.<br><br>
                관측 조건 등급은 <b>그날 밤의 달 밝기만</b>을 기준으로 한 참고값입니다.
                달이 뜨고 지는 시각, 그날의 날씨와 빛공해는 반영하지 않으므로 실제 관측 결과와 다를 수 있습니다.
                유성우 극대 시각은 해마다 예보가 조금씩 조정되며, 특히 다음 해 일정은 잠정값입니다.
                정확한 공식 정보는 <a href="https://astro.kasi.re.kr/" target="_blank" rel="noopener">한국천문연구원 천문우주지식정보</a>를 확인해 주세요.
            </div>

            <a class="cta-lounge" href="lounge.html">
                <div class="ct">별 보러 갔다 왔다면 →</div>
                <div class="cd">그날 밤 하늘이 어땠는지, 몇 개나 봤는지 관측 후기 궤도에 남겨주세요. 같은 하늘을 본 사람들이 모여 있습니다.</div>
            </a>
        </section>
    </main>

    <footer class="site-footer">
        <div class="foot-links">
            <a href="main.html">커뮤니티 홈</a>
            <a href="sky.html">밤하늘 달력</a>
            <a href="lounge.html">글 남기기</a>
            <a href="terms.html">이용약관</a>
            <a href="privacy.html">개인정보처리방침</a>
        </div>
        <div class="foot-sign">
            © 2026 Orbit · Made with
            <svg class="foot-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M 50 15 L 62 34 L 83 39 L 69 56 L 71 78 L 50 70 L 29 78 L 31 56 L 17 39 L 38 34 Z" fill="#FF9F43" stroke="#FF9F43" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/></svg>
            in orbit
        </div>
    </footer>

    <script>
    // ============================================================
    //  밤하늘 달력
    //  - 이벤트 일정: KASI / IMO 공개 자료 기준 (아래 EVENTS)
    //  - 달의 위상/밝기/월령: Meeus 천문 알고리즘으로 직접 계산
    //    (하드코딩이 아니라 계산이므로 몇 년 뒤 날짜도 그대로 맞는다)
    // ============================================================

    // ---------- 달 계산 ----------
    var RAD = Math.PI / 180;
    function toJD(d) { return d.getTime() / 86400000 + 2440587.5; }
    function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }

    // Meeus 「Astronomical Algorithms」 47장·48장
    // 반환: illum(0~1 조도), age(월령 일), waxing(차오르는 중인지)
    function moonInfo(date) {
        var T  = (toJD(date) - 2451545.0) / 36525.0;
        var T2 = T * T, T3 = T2 * T, T4 = T3 * T;
        // 달의 평균 이각 (D=0 신월, D=180 보름)
        var D  = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000);
        // 태양의 평균 근점이각
        var M  = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
        // 달의 평균 근점이각
        var Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000);

        // 위상각 i (Meeus 48.4) — 태양-달-지구가 이루는 각
        var i = 180 - D
              - 6.289 * Math.sin(Mp * RAD)
              + 2.100 * Math.sin(M  * RAD)
              - 1.274 * Math.sin((2 * D - Mp) * RAD)
              - 0.658 * Math.sin(2 * D * RAD)
              - 0.214 * Math.sin(2 * Mp * RAD)
              - 0.110 * Math.sin(D * RAD);

        return {
            illum:  (1 + Math.cos(i * RAD)) / 2,
            age:    D / 360 * 29.530588853,
            waxing: D < 180
        };
    }

    function phaseName(m) {
        var k = m.illum;
        if (k < 0.02) return '삭 (신월)';
        if (k > 0.98) return '보름달';
        if (Math.abs(k - 0.5) < 0.06) return m.waxing ? '상현달' : '하현달';
        if (k < 0.5) return m.waxing ? '초승달' : '그믐달';
        // 상현~보름, 보름~하현 사이는 한국어에 자리잡은 이름이 없다.
        // ('상현망간의 달'은 쓰는 사람이 없다) 눈에 보이는 그대로 부른다.
        // 차오르는 중인지 기우는 중인지는 달 그림 모양과 월령이 알려준다.
        return '거의 보름달';
    }

    // 달을 SVG로 그린다. 밝은 부분의 경계(명암경계선)는
    // 반지름이 r*|2k-1| 인 타원 호가 된다.
    function moonSVG(m, r) {
        var k = m.illum;
        var rx = (r * Math.abs(2 * k - 1)).toFixed(2);
        // 아래쪽(0,r)에서 위쪽(0,-r)으로 돌아오는 호의 방향.
        // sweep=1이면 왼쪽으로 부풀어 볼록달, sweep=0이면 오른쪽으로 파여 초승달이 된다.
        var sweep = k < 0.5 ? 0 : 1;
        var size = r * 2 + 8, c = size / 2;
        var lit = 'M 0 ' + (-r) +
                  ' A ' + r + ' ' + r + ' 0 0 1 0 ' + r +
                  ' A ' + rx + ' ' + r + ' 0 0 ' + sweep + ' 0 ' + (-r) + ' Z';
        // 기우는 달은 왼쪽이 밝으므로 좌우 반전
        var flip = m.waxing ? '' : ' scale(-1,1)';
        return '' +
        '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-label="달 모양">' +
          '<defs>' +
            '<radialGradient id="mg" cx="38%" cy="34%">' +
              '<stop offset="0%" stop-color="#FFF3DC"/>' +
              '<stop offset="70%" stop-color="#FFD08A"/>' +
              '<stop offset="100%" stop-color="#F0B45E"/>' +
            '</radialGradient>' +
          '</defs>' +
          '<g transform="translate(' + c + ',' + c + ')">' +
            '<circle r="' + r + '" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>' +
            '<g transform="' + flip + '"><path d="' + lit + '" fill="url(#mg)"/></g>' +
          '</g>' +
        '</svg>';
    }

    // ---------- 관측 조건 등급 (달 밝기 기준) ----------
    // 화면에 보여주는 퍼센트(반올림값)를 그대로 기준으로 삼는다.
    // 내부 소수값으로 나누면 "달 25%인데 등급은 양호" 같은 어긋남이 생긴다.
    function condOf(illum) {
        var pct = Math.round(illum * 100);
        var c;
        if      (pct <= 25) c = { cls: 'best', label: '관측 조건 최상' };
        else if (pct <= 50) c = { cls: 'good', label: '관측 조건 양호' };
        else if (pct <= 75) c = { cls: 'fair', label: '관측 조건 보통' };
        else                c = { cls: 'poor', label: '달빛 방해 큼' };
        c.pct = pct;
        return c;
    }

    // ---------- 이벤트 데이터 ----------
    // watch : 실제로 하늘을 봐야 하는 시각(KST). D-day와 정렬의 기준.
    // peak  : 극대/최대식 시각. 낮이면 국내에서 그 순간은 볼 수 없다.
    // kr    : 국내 관측 가능 여부.
    var EVENTS = [
        {
            id:'perseids2026', type:'meteor', ic:'☄️', kr:true,
            name:'페르세우스자리 유성우',
            watch:'2026-08-12T23:00:00+09:00',
            dateText:'2026년 8월 12일 밤 ~ 14일 새벽',
            peakText:'8월 13일 12시경 (KST)',
            zhr:100,
            radiant:'페르세우스자리 — 북동쪽 하늘',
            best:'12일 밤~13일 새벽, 13일 밤~14일 새벽 모두 좋습니다. 자정 이후가 특히 유리합니다.',
            desc:'3대 유성우 중 하나이며, 여름 휴가철과 겹쳐 가장 보기 좋은 유성우로 꼽힙니다. 스위프트-터틀 혜성이 남긴 부스러기가 지구 대기와 부딪히며 타는 현상입니다. 2026년은 극대 직전인 8월 12일이 신월이라 밤새 달빛 방해가 사실상 없습니다 — 몇 년 만에 오는 최상의 조건입니다.',
            hi:true
        },
        {
            id:'tse2026', type:'eclipse', ic:'🌑', kr:false,
            name:'개기일식 (국내 관측 불가)',
            watch:'2026-08-13T02:47:00+09:00',
            dateText:'2026년 8월 12일 (최대식 17:47 UTC)',
            peakText:'한국 시각으로 8월 13일 새벽 2시 47분',
            radiant:null,
            best:null,
            desc:'21세기 들어 유럽 대륙에서 볼 수 있는 첫 개기일식입니다. 개기식대는 북극 상공에서 그린란드 동부와 아이슬란드를 지나 스페인 북부까지 이어집니다. 최대 지속 시간은 약 2분 18초입니다. 한국은 이 시각이 한밤중이라 해가 지평선 아래에 있어 부분일식조차 볼 수 없습니다.'
        },
        {
            id:'ple2026', type:'eclipse', ic:'🌗', kr:false,
            name:'부분월식 (국내 관측 불가)',
            watch:'2026-08-28T13:12:00+09:00',
            dateText:'2026년 8월 28일 (최대식 04:12 UTC)',
            peakText:'한국 시각으로 8월 28일 오후 1시 12분',
            desc:'달의 약 96%가 지구 본그림자에 들어가는, 개기월식에 가까운 매우 깊은 부분월식입니다. 아메리카 대륙에서 가장 잘 보이고 유럽·아프리카에서는 달이 지기 직전 낮게 보입니다. 한국은 이 시각이 대낮이라 달이 지평선 아래에 있어 관측할 수 없습니다.'
        },
        {
            id:'orionids2026', type:'meteor', ic:'☄️', kr:true,
            name:'오리온자리 유성우',
            watch:'2026-10-21T02:00:00+09:00',
            dateText:'2026년 10월 21일 전후 새벽',
            peakText:'10월 21일 전후 (해마다 조정)',
            zhr:20,
            radiant:'오리온자리 — 동쪽~남동쪽 하늘',
            best:'복사점이 충분히 높이 올라오는 자정 이후~새벽이 좋습니다.',
            desc:'핼리 혜성이 남긴 부스러기로 만들어지는 유성우입니다. 개수는 많지 않지만 유성의 속도가 매우 빨라 밝고 긴 자취를 남기는 것이 특징입니다.'
        },
        {
            id:'leonids2026', type:'meteor', ic:'☄️', kr:true,
            name:'사자자리 유성우',
            watch:'2026-11-17T03:00:00+09:00',
            dateText:'2026년 11월 17일 전후 새벽',
            peakText:'11월 17일 전후 (해마다 조정)',
            zhr:15,
            radiant:'사자자리 — 동쪽 하늘',
            best:'사자자리가 떠오르는 자정 이후~새벽.',
            desc:'평년에는 조용하지만 약 33년 주기로 시간당 수천 개가 쏟아지는 "유성 폭풍"을 일으킨 전력이 있는 유성우입니다. 유성의 진입 속도가 가장 빠른 편에 속합니다.'
        },
        {
            id:'geminids2026', type:'meteor', ic:'🌠', kr:true,
            name:'쌍둥이자리 유성우',
            watch:'2026-12-14T23:00:00+09:00',
            dateText:'2026년 12월 14일 밤 ~ 15일 새벽',
            peakText:'12월 14일 23시 (KST)',
            zhr:150,
            radiant:'쌍둥이자리 — 북동쪽 하늘',
            best:'극대 시각이 한국의 밤과 정확히 겹칩니다. 14일 밤부터 15일 새벽까지가 최적입니다.',
            desc:'1년 중 가장 많은 유성이 떨어지는 유성우입니다. 혜성이 아니라 소행성 파에톤이 남긴 부스러기라는 점이 독특합니다. 유성의 속도가 느린 편이라 초보자도 알아보기 쉽고, 2026년은 극대 시각이 한국 밤 시간과 겹치는 데다 달빛 방해도 적어 조건이 매우 좋습니다.',
            hi:true
        },
        {
            id:'ursids2026', type:'meteor', ic:'☄️', kr:true,
            name:'작은곰자리 유성우',
            watch:'2026-12-22T02:00:00+09:00',
            dateText:'2026년 12월 22일 전후 새벽',
            peakText:'12월 22일 전후 (해마다 조정)',
            zhr:10,
            radiant:'작은곰자리 — 북쪽 하늘 (북극성 부근)',
            best:'복사점이 북쪽 하늘에 늘 떠 있어 밤새 관측할 수 있습니다.',
            desc:'개수는 적지만 복사점이 북극성 근처라 밤새 지지 않는다는 장점이 있습니다. 한겨울 추위 대비가 관측의 절반입니다.'
        },
        {
            id:'supermoon2026', type:'moon', ic:'🌕', kr:true,
            name:'2026년 가장 큰 보름달 (슈퍼문)',
            watch:'2026-12-24T19:00:00+09:00',
            dateText:'2026년 12월 24일 · 크리스마스이브',
            peakText:'해가 진 직후부터 밤새',
            desc:'달이 지구에 가장 가까운 지점 근처에서 보름이 되어, 2026년 한 해 중 가장 크고 밝게 보이는 보름달입니다. 크리스마스이브 밤에 뜬다는 점에서 더 특별합니다. 지평선 근처에 낮게 떠 있을 때 건물이나 산과 함께 보면 훨씬 크게 느껴집니다.',
            hi:true
        },
        {
            id:'quadrantids2027', type:'meteor', ic:'☄️', kr:true,
            name:'사분의자리 유성우',
            watch:'2027-01-04T03:00:00+09:00',
            dateText:'2027년 1월 3일 밤 ~ 4일 새벽',
            peakText:'1월 3~4일 (해마다 조정 · 잠정)',
            zhr:120,
            radiant:'목동자리 부근 — 북동쪽 하늘',
            best:'극대가 몇 시간으로 매우 짧아 날짜를 정확히 맞춰야 합니다.',
            desc:'3대 유성우 중 하나지만 극대가 몇 시간밖에 지속되지 않아 타이밍을 놓치기 쉽습니다. 한겨울 새벽이라 관측 난이도도 높은 편이지만, 조건이 맞으면 3대 유성우답게 화려합니다.'
        },
        {
            id:'ase2027', type:'eclipse', ic:'🌑', kr:false,
            name:'금환일식 (국내 관측 불가)',
            watch:'2027-02-06T21:00:00+09:00',
            dateText:'2027년 2월 6일',
            peakText:'—',
            desc:'달이 태양보다 작게 보여 태양 가장자리가 반지처럼 남는 금환일식입니다. 남아메리카 남부와 대서양 일대에서 관측됩니다. 한국에서는 볼 수 없습니다.'
        },
        {
            id:'lyrids2027', type:'meteor', ic:'☄️', kr:true,
            name:'거문고자리 유성우',
            watch:'2027-04-22T03:00:00+09:00',
            dateText:'2027년 4월 22일 전후 새벽',
            peakText:'4월 22일 전후 (잠정)',
            zhr:18,
            radiant:'거문고자리 — 동쪽 하늘 (직녀성 부근)',
            best:'자정 이후 복사점이 높이 뜬 뒤가 좋습니다.',
            desc:'기록에 남은 가장 오래된 유성우 중 하나로, 2,600년 전 중국 기록에도 등장합니다. 개수는 많지 않지만 가끔 아주 밝은 유성이 섞여 나옵니다.'
        },
        {
            id:'etaaqr2027', type:'meteor', ic:'☄️', kr:true,
            name:'물병자리 에타 유성우',
            watch:'2027-05-06T03:30:00+09:00',
            dateText:'2027년 5월 6일 전후 새벽',
            peakText:'5월 6일 전후 (잠정)',
            zhr:50,
            radiant:'물병자리 — 동쪽 하늘 (낮게 뜸)',
            best:'복사점이 낮아 동틀 무렵 새벽에만 잠깐 볼 수 있습니다.',
            desc:'오리온자리 유성우와 마찬가지로 핼리 혜성이 남긴 부스러기입니다. 남반구에서 훨씬 잘 보이고, 한국에서는 복사점이 낮게 떠서 새벽 짧은 시간에만 관측할 수 있습니다.'
        },
        {
            id:'tse2027', type:'eclipse', ic:'🌑', kr:false,
            name:'개기일식 (국내 관측 불가)',
            watch:'2027-08-02T20:00:00+09:00',
            dateText:'2027년 8월 2일',
            peakText:'—',
            desc:'최대 지속 시간이 약 6분 23초에 달하는, 21세기 육지에서 관측 가능한 가장 긴 개기일식입니다. 스페인 남부와 북아프리카를 지나 이집트 룩소르 상공을 통과합니다. 맑은 날이 많은 지역을 지나기 때문에 "세기의 일식"으로 불리며 벌써부터 원정 관측 계획이 세워지고 있습니다. 한국에서는 볼 수 없습니다.'
        }
    ];

    // ---------- 렌더링 ----------
    var $ = function (id) { return document.getElementById(id); };
    var MS_DAY = 86400000;

    function parseKST(s) { return new Date(s); }

    function fmtDday(ms) {
        if (ms <= 0) return null;
        var d = Math.floor(ms / MS_DAY);
        var h = Math.floor((ms % MS_DAY) / 3600000);
        var m = Math.floor((ms % 3600000) / 60000);
        var s = Math.floor((ms % 60000) / 1000);
        return { d: d, h: h, m: m, s: s };
    }

    // 지난 이벤트를 제외하고 가까운 순으로 정렬
    function upcoming() {
        var now = Date.now();
        return EVENTS
            .map(function (e) { return { e: e, t: parseKST(e.watch).getTime() }; })
            .filter(function (x) { return x.t > now; })
            .sort(function (a, b) { return a.t - b.t; });
    }

    function renderNext() {
        var list = upcoming();
        if (!list.length) {
            $('nxName').textContent = '예정된 현상이 없습니다';
            $('nxWhen').textContent = '달력을 업데이트할 시기입니다';
            $('nxDday').textContent = '—';
            return;
        }
        var e = list[0].e, t = list[0].t;
        $('nxEmoji').textContent = e.ic;
        $('nxName').textContent = e.name;
        $('nxWhen').textContent = e.dateText;

        var moon = moonInfo(new Date(t));
        var cond = condOf(moon.illum);
        var noteHtml;
        if (e.kr === false) {
            noteHtml = '<strong>국내에서는 볼 수 없습니다.</strong> 이 현상은 다른 지역에서만 관측됩니다. ' +
                       '아래 목록에서 국내 관측 가능한 현상만 따로 볼 수 있어요.';
        } else if (e.type === 'meteor') {
            noteHtml = '그날 밤 달 밝기는 <strong>' + cond.pct + '%</strong> — ' +
                       cond.label + '입니다. ' +
                       (e.best || '');
        } else {
            noteHtml = e.best || e.desc.split('.')[0] + '.';
        }
        $('nxNote').innerHTML = noteHtml;

        function tick() {
            var left = fmtDday(t - Date.now());
            if (!left) { renderNext(); renderTimeline(); return; }
            $('nxDday').textContent = 'D-' + (left.d === 0 ? 'DAY' : left.d);
            $('nxDdaySub').textContent = left.d === 0 ? '오늘 밤입니다' : '남았습니다';
            $('nxUnits').innerHTML =
                '<div class="cd-unit"><b>' + left.d + '</b><span>일</span></div>' +
                '<div class="cd-unit"><b>' + left.h + '</b><span>시간</span></div>' +
                '<div class="cd-unit"><b>' + left.m + '</b><span>분</span></div>' +
                '<div class="cd-unit"><b>' + left.s + '</b><span>초</span></div>';
        }
        tick();
        if (window.__nxTimer) clearInterval(window.__nxTimer);
        window.__nxTimer = setInterval(tick, 1000);
    }

    function renderMoon() {
        var m = moonInfo(new Date());
        $('moonVis').innerHTML = moonSVG(m, 42);
        $('mmPhase').textContent = phaseName(m);
        $('mmAge').textContent = m.age.toFixed(1) + '일';
        $('mmIllum').textContent = Math.round(m.illum * 100) + '%';

        var hint;
        if (m.illum <= 0.25)      hint = '달이 어두워 별 보기 좋은 밤입니다.';
        else if (m.illum <= 0.6)  hint = '달이 적당히 밝습니다. 밝은 별은 충분히 보여요.';
        else if (m.illum <= 0.9)  hint = '달이 꽤 밝아 어두운 별은 묻힙니다.';
        else                      hint = '보름 무렵이라 하늘 전체가 밝습니다. 달 자체를 보기엔 최고예요.';
        $('mmHint').textContent = hint;
    }

    var curFilter = 'all';

    function renderTimeline() {
        var now = Date.now();
        var rows = EVENTS
            .map(function (e) { return { e: e, t: parseKST(e.watch).getTime() }; })
            .filter(function (x) { return x.t > now; })
            .sort(function (a, b) { return a.t - b.t; })
            .filter(function (x) {
                if (curFilter === 'all') return true;
                if (curFilter === 'kr')  return x.e.kr;
                return x.e.type === curFilter;
            });

        if (!rows.length) {
            $('timeline').innerHTML =
                '<div class="notice" style="margin-top:0;">해당하는 예정 현상이 없습니다. 다른 조건으로 찾아보세요.</div>';
            return;
        }

        $('timeline').innerHTML = rows.map(function (x) {
            var e = x.e;
            var days = Math.ceil((x.t - now) / MS_DAY);
            var moon = moonInfo(new Date(x.t));
            var cond = condOf(moon.illum);

            var badges = '';
            // 관측 조건 배지는 국내에서 볼 수 있는 유성우에만 의미가 있다
            if (e.kr && e.type === 'meteor') {
                badges += '<span class="bdg ' + cond.cls + '">' + cond.label +
                          ' · 달 ' + cond.pct + '%</span>';
            }
            badges += e.kr
                ? '<span class="bdg kr"><span class="bi">🇰🇷</span>국내 관측 가능</span>'
                : '<span class="bdg nokr">국내 관측 불가</span>';
            if (e.zhr) badges += '<span class="bdg zhr">최대 시간당 ' + e.zhr + '개(ZHR)</span>';
            if (e.hi)  badges += '<span class="bdg best"><span class="bi">✨</span>올해의 하이라이트</span>';

            var rowsHtml = '';
            function row(l, v) {
                if (!v) return '';
                return '<div class="ev-row"><div class="rl">' + l + '</div><div class="rv">' + v + '</div></div>';
            }
            rowsHtml += row('극대 시각', e.peakText);
            rowsHtml += row('복사점', e.radiant);
            rowsHtml += row('관측 적기', e.best);
            if (e.kr) {
                rowsHtml += row('그날의 달',
                    '밝기 ' + cond.pct + '% · 월령 ' + moon.age.toFixed(1) + '일 (' + phaseName(moon) + ')');
            }

            return '' +
            '<article class="ev" data-id="' + e.id + '" tabindex="0">' +
              '<div class="ev-top">' +
                '<div class="ev-ic">' + e.ic + '</div>' +
                '<div class="ev-mid">' +
                  '<div class="ev-name">' + e.name + '</div>' +
                  '<div class="ev-date">' + e.dateText + '</div>' +
                '</div>' +
                '<div class="ev-dday">D-' + (days <= 0 ? 'DAY' : days) + '</div>' +
              '</div>' +
              '<div class="badges">' + badges + '</div>' +
              '<div class="ev-body">' +
                '<p class="ev-desc">' + e.desc + '</p>' +
                '<div class="ev-rows">' + rowsHtml + '</div>' +
              '</div>' +
            '</article>';
        }).join('');
    }

    // 카드 펼치기 — 클릭과 키보드(Enter/Space) 모두
    document.addEventListener('click', function (ev) {
        var card = ev.target.closest('.ev');
        if (card) card.classList.toggle('open');
    });
    document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        var card = ev.target.closest && ev.target.closest('.ev');
        if (!card) return;
        ev.preventDefault(); // Space의 페이지 스크롤 방지
        card.classList.toggle('open');
    });

    // 필터
    $('filterRow').addEventListener('click', function (ev) {
        var b = ev.target.closest('.fbtn');
        if (!b) return;
        curFilter = b.getAttribute('data-f');
        Array.prototype.forEach.call(this.querySelectorAll('.fbtn'), function (x) {
            x.classList.toggle('on', x === b);
        });
        renderTimeline();
    });

    renderNext();
    renderMoon();
    renderTimeline();

    // ===== 임베드될 때 부모에게 콘텐츠 높이 알리기 =====
    // 이게 없으면 메인의 iframe이 고정 620px에 머물러
    // 2000px가 넘는 달력이 그 안에서 따로 스크롤된다 — 페이지 안에 스크롤바가
    // 하나 더 생기고 내용이 빽빽해 보이는 원인이었다.
    // 필터를 바꾸면 목록 길이가 달라지므로 ResizeObserver로 그 순간들을 잡는다.
    (function(){
        if(!document.documentElement.classList.contains('embed')) return;
        var box = document.querySelector('.container');
        var last = 0;
        function report(){
            var h = Math.ceil(box.getBoundingClientRect().height);
            if(h && h !== last){
                last = h;
                parent.postMessage({ orbit:'skyHeight', height:h }, window.location.origin);
            }
        }
        if(window.ResizeObserver) new ResizeObserver(report).observe(box);
        else setInterval(report, 500); // 아주 옛 브라우저 폴백
        window.addEventListener('load', report);
        if(document.fonts && document.fonts.ready) document.fonts.ready.then(report);
        report();
    })();
    </script>
</body>
</html>
````


## `lounge.html`

> 1141줄 · 59778바이트

커뮤니티 전체가 이 파일 하나다. 채널 탭·글쓰기·목록·이모지 리액션·댓글·신고·삭제. Supabase URL/키가 여기(447-448)와 admin.html 두 곳에 있다. ORBIT_LIST가 채널 단일 설정이고, DB의 posts_orbit_check 제약과 짝을 이룬다.

````html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orbit | 글 남기기</title>
    <meta name="description" content="어젯밤 뭘 보셨나요 — 관측 후기와 장비, 실시간 하늘 이야기를 남기는 곳.">
    <meta name="theme-color" content="#0F172A">
    <link rel="canonical" href="https://orbithere.com/lounge.html">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Orbit">
    <meta property="og:title" content="Orbit | 글 남기기">
    <meta property="og:description" content="어젯밤 뭘 보셨나요 — 관측 후기와 장비, 실시간 하늘 이야기를 남기는 곳.">
    <meta property="og:image" content="https://orbithere.com/images/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="https://orbithere.com/lounge.html">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
    <link rel="stylesheet" href="/orbit.css">
    <style>
        body { touch-action: manipulation; }   /* 나머지 기본값은 orbit.css */

        .container { max-width: 680px; margin: 130px auto 80px; padding: 0 20px; }

        header { margin-bottom: 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .header-text { min-width: 0; }
        header h1 { font-size: 2.2rem; font-weight: 200; margin: 0; line-height: 1.2; }
        header h1 span { color: var(--accent); font-weight: 700; }
        header p { color: #94A3B8; margin-top: 10px; font-size: 0.95rem; }
        .mock-badge {
            display: inline-block; margin-top: 12px;
            font-size: 10px; padding: 3px 10px; border-radius: 99px;
            background: rgba(159,122,234,0.1); color: #9F7AEA;
            border: 1px solid rgba(159,122,234,0.25); font-weight: 600;
            letter-spacing: 0.04em;
        }

        /* 궤도(보드) 탭 */
        .orbit-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
        .orbit-tab {
            font-size: 12px; padding: 7px 16px; border-radius: 20px;
            border: 1.5px solid rgba(255,159,67,0.2); background: transparent;
            cursor: pointer; color: #94A3B8; transition: all 0.2s;
            font-family: 'Pretendard'; font-weight: 500;
        }
        .orbit-tab:hover { border-color: rgba(255,159,67,0.45); color: var(--accent); }
        .orbit-tab.on { background: var(--accent); border-color: var(--accent); color: #0F172A; font-weight: 700; }
        .orbit-tab .ic { margin-right: 1px; }

        /* 채널 헤더 — 선택한 궤도의 장소감 */
        .channel-header {
            display: flex; align-items: center; gap: 12px;
            background: rgba(255,159,67,0.05);
            border: 1px solid rgba(255,159,67,0.12);
            border-radius: 16px; padding: 14px 18px; margin-bottom: 24px;
            animation: post-in 0.3s ease both;
        }
        .channel-header .ch-icon {
            width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; background: rgba(255,159,67,0.1);
            border: 1px solid rgba(255,159,67,0.2);
        }
        .channel-header .ch-text { min-width: 0; }
        .channel-header .ch-name { font-size: 14px; font-weight: 700; color: var(--text-main); }
        .channel-header .ch-desc { font-size: 11.5px; color: #94A3B8; margin-top: 3px; line-height: 1.45; }

        /* 새로고침 — 이 궤도의 궤적만 다시 불러온다 */
        .btn-refresh {
            margin-left: auto; flex-shrink: 0;
            display: inline-flex; align-items: center; gap: 6px;
            background: transparent; color: #94A3B8;
            border: 1px solid rgba(255,159,67,0.18); border-radius: 99px;
            padding: 7px 13px; font-size: 11.5px; font-weight: 600;
            font-family: 'Pretendard'; cursor: pointer; transition: all 0.15s;
        }
        .btn-refresh:hover { border-color: rgba(255,159,67,0.45); color: var(--accent); }
        .btn-refresh svg { width: 13px; height: 13px; flex-shrink: 0; transform-origin: 50% 50%; }
        .btn-refresh.spin { color: var(--accent); border-color: rgba(255,159,67,0.45); cursor: default; }
        .btn-refresh.spin svg { animation: rf-spin 0.7s linear infinite; }
        @keyframes rf-spin { to { transform: rotate(360deg); } }
        /* 좁은 화면에서는 아이콘만 — 채널 이름이 밀리지 않게.
           대신 손가락으로 누를 수 있는 크기(약 40px)는 유지한다. */
        @media (max-width: 480px) {
            .btn-refresh {
                padding: 0; justify-content: center;
                min-width: 40px; min-height: 40px;
            }
            .btn-refresh .rf-lbl { display: none; }
            .btn-refresh svg { width: 15px; height: 15px; }
        }

        /* 글쓰기 카드 */
        .write-card {
            background: var(--card-bg);
            border: 1px solid rgba(255,159,67,0.15);
            border-radius: 20px; padding: 20px;
            margin-bottom: 28px;
        }
        .write-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .write-avatar {
            width: 36px; height: 36px; border-radius: 50%;
            background: linear-gradient(135deg, rgba(255,159,67,0.2), rgba(255,183,77,0.15));
            border: 1.5px solid rgba(255,159,67,0.3);
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; flex-shrink: 0;
        }
        .write-nick { font-size: 13px; font-weight: 600; color: #CBD5E1; }
        .write-orbit-select {
            margin-left: auto; font-size: 11px; color: var(--accent);
            background: rgba(255,159,67,0.08); border: 1px solid rgba(255,159,67,0.2);
            border-radius: 8px; padding: 5px 8px; font-family: 'Pretendard';
            outline: none; cursor: pointer;
        }
        .write-card textarea {
            width: 100%; min-height: 72px; resize: vertical;
            background: rgba(15,23,42,0.5);
            border: 1px solid rgba(255,159,67,0.2);
            border-radius: 12px; padding: 12px 14px;
            color: var(--text-main); font-family: 'Pretendard'; font-size: 13px;
            line-height: 1.6; outline: none; transition: border-color 0.2s;
        }
        .write-card textarea:focus { border-color: var(--accent); }
        /* 모바일에서 16px 미만이면 iOS Safari가 포커스 순간 페이지를 자동 확대한다 */
        @media (max-width: 768px) { .write-card textarea { font-size: 16px; } }
        .write-card textarea::placeholder { color: #64748B; }
        .write-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
        .write-count { font-size: 11px; color: #64748B; }
        .btn-trace {
            background: var(--accent); color: #0F172A; border: none;
            border-radius: 10px; padding: 9px 20px;
            font-weight: 700; font-size: 12px; cursor: pointer;
            transition: 0.2s; font-family: 'Pretendard';
        }
        .btn-trace:hover { opacity: 0.88; transform: scale(0.98); }
        .btn-trace:disabled { opacity: 0.3; cursor: default; transform: none; }

        /* 미가입 상태 안내 */
        .need-join { text-align: center; padding: 8px 0; }
        .need-join p { font-size: 13px; color: #64748B; margin: 0 0 12px; }
        .btn-go-join {
            background: transparent; color: var(--accent);
            border: 1.5px solid rgba(255,159,67,0.3); border-radius: 10px;
            padding: 9px 20px; font-weight: 600; font-size: 12px;
            cursor: pointer; transition: 0.2s; font-family: 'Pretendard';
        }
        .btn-go-join:hover { background: rgba(255,159,67,0.08); border-color: var(--accent); }

        /* 궤적(글) 카드 */
        .post {
            background: var(--card-bg);
            border: 1px solid rgba(255,159,67,0.12);
            border-radius: 20px; padding: 20px;
            margin-bottom: 14px;
            transition: border-color 0.25s;
            animation: post-in 0.4s ease both;
        }
        .post:hover { border-color: rgba(255,159,67,0.35); }
        @keyframes post-in {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .post-avatar {
            width: 36px; height: 36px; border-radius: 50%;
            background: rgba(255,255,255,0.04);
            border: 1.5px solid rgba(255,255,255,0.08);
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; flex-shrink: 0;
        }
        .post-meta { flex: 1; min-width: 0; }
        .post-nick { font-size: 13px; font-weight: 600; color: #CBD5E1; }
        .post-sub { font-size: 10px; color: #64748B; margin-top: 2px; }
        .post-orbit-chip {
            font-size: 10px; padding: 3px 9px; border-radius: 8px;
            background: rgba(255,159,67,0.08); color: var(--accent);
            font-weight: 600; flex-shrink: 0;
        }
        .post-orbit-chip.mine { background: rgba(159,122,234,0.1); color: #9F7AEA; }
        .post-body { font-size: 13.5px; line-height: 1.7; color: #CBD5E1; white-space: pre-wrap; word-break: break-word; }
        .post-foot { display: flex; align-items: center; gap: 8px; margin-top: 14px; }

        /* 이모지 교차 리액션 */
        /* flex:1로 늘리지 않는다 — 늘리면 리액션이 없는 글에서 옆의 댓글 버튼이
           오른쪽 끝까지 밀려 사이가 휑해진다. 내용만큼만 차지하고,
           오른쪽으로 밀려야 하는 건 .btn-del의 margin-left:auto가 맡는다. */
        .reaction-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; position: relative; flex: 0 1 auto; min-width: 0; }
        .rx-chip {
            display: inline-flex; align-items: center; gap: 5px;
            background: rgba(255,255,255,0.03); color: #94A3B8;
            border: 1px solid rgba(255,255,255,0.07); border-radius: 99px;
            padding: 5px 11px; font-size: 13px; cursor: pointer;
            transition: all 0.15s; font-family: 'Pretendard';
        }
        .rx-chip .n { font-size: 11px; font-weight: 600; }
        .rx-chip:hover { border-color: rgba(255,159,67,0.4); }
        .rx-chip.mine { background: rgba(255,159,67,0.13); border-color: rgba(255,159,67,0.45); color: var(--accent); }
        .rx-add {
            width: 28px; height: 28px; border-radius: 50%;
            display: inline-flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,0.03); color: #64748B;
            border: 1px dashed rgba(255,255,255,0.15);
            font-size: 15px; cursor: pointer; transition: all 0.15s; font-family: 'Pretendard';
        }
        .rx-add:hover { border-color: rgba(255,159,67,0.5); color: var(--accent); }
        .rx-palette {
            position: absolute; bottom: calc(100% + 8px); left: 0;
            background: #1B2538; border: 1px solid rgba(255,159,67,0.25);
            border-radius: 14px; padding: 7px; display: flex; gap: 3px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.45); z-index: 20;
            animation: pal-in 0.16s ease;
        }
        @keyframes pal-in { from { opacity: 0; transform: translateY(6px) scale(0.92); } }
        .rx-pal-btn {
            width: 36px; height: 36px; border-radius: 10px; border: none;
            background: transparent; font-size: 18px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.12s;
        }
        .rx-pal-btn:hover { background: rgba(255,159,67,0.14); }
        .btn-del {
            margin-left: auto; flex-shrink: 0;
            width: 28px; height: 28px; border-radius: 8px;
            display: inline-flex; align-items: center; justify-content: center;
            background: transparent; border: 1px solid rgba(255,255,255,0.07);
            color: #64748B; cursor: pointer; transition: all 0.15s;
        }
        .btn-del:hover { border-color: rgba(252,129,129,0.5); color: #FC8181; background: rgba(252,129,129,0.06); }
        .btn-del svg { width: 13px; height: 13px; }

        /* ===== 댓글 ===== */
        .btn-cmt {
            display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
            background: rgba(255,255,255,0.03); color: #94A3B8;
            border: 1px solid rgba(255,255,255,0.07); border-radius: 99px;
            padding: 5px 11px; font-size: 13px; cursor: pointer;
            transition: all 0.15s; font-family: 'Pretendard';
        }
        .btn-cmt:hover { border-color: rgba(255,159,67,0.4); color: var(--accent); }
        .btn-cmt.on { background: rgba(255,159,67,0.13); border-color: rgba(255,159,67,0.45); color: var(--accent); }
        .btn-cmt .cn { font-size: 11px; font-weight: 600; }

        .cmt-thread {
            margin-top: 14px; padding-top: 14px;
            border-top: 1px solid rgba(255,159,67,0.1);
        }
        .cmt-list { display: flex; flex-direction: column; gap: 13px; margin-bottom: 13px; }
        .cmt-empty { font-size: 12px; color: #64748B; margin-bottom: 13px; }
        .cmt { display: flex; gap: 9px; align-items: flex-start; }
        .cmt-av {
            width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
            display: flex; align-items: center; justify-content: center; font-size: 12px;
        }
        .cmt-main { flex: 1; min-width: 0; }
        .cmt-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; flex-wrap: wrap; }
        .cmt-nick { font-size: 12px; font-weight: 600; color: #CBD5E1; }
        .cmt-me { font-size: 9px; color: #9F7AEA; }
        .cmt-time { font-size: 10px; color: #64748B; }
        .cmt-body { font-size: 12.5px; line-height: 1.65; color: #94A3B8; white-space: pre-wrap; word-break: break-word; }
        .btn-cmt-del {
            flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px;
            display: inline-flex; align-items: center; justify-content: center;
            background: transparent; border: 1px solid rgba(255,255,255,0.06);
            color: #64748B; cursor: pointer; transition: all 0.15s;
            font-size: 14px; line-height: 1; font-family: 'Pretendard';
        }
        .btn-cmt-del:hover { border-color: rgba(252,129,129,0.5); color: #FC8181; }

        .cmt-write { display: flex; gap: 7px; align-items: center; }
        .cmt-write input {
            flex: 1; min-width: 0;
            background: rgba(15,23,42,0.5); border: 1px solid rgba(255,159,67,0.18);
            border-radius: 10px; padding: 9px 12px;
            color: var(--text-main); font-family: 'Pretendard'; font-size: 12.5px;
            outline: none; transition: border-color 0.2s;
        }
        .cmt-write input:focus { border-color: var(--accent); }
        .cmt-write input::placeholder { color: #64748B; }
        /* 모바일에서 16px 미만이면 iOS Safari가 포커스 순간 페이지를 자동 확대한다 */
        @media (max-width: 768px) { .cmt-write input { font-size: 16px; } }
        .btn-cmt-send {
            flex-shrink: 0; background: var(--accent); color: #0F172A; border: none;
            border-radius: 10px; padding: 9px 15px; font-weight: 700; font-size: 12px;
            cursor: pointer; transition: 0.2s; font-family: 'Pretendard';
        }
        .btn-cmt-send:hover { opacity: 0.88; }
        .btn-cmt-send:disabled { opacity: 0.35; cursor: default; }
        .cmt-need-join { font-size: 12px; color: #64748B; }
        .cmt-need-join button {
            background: none; border: none; padding: 0; cursor: pointer;
            color: var(--accent); font-family: 'Pretendard'; font-size: 12px;
            font-weight: 600; text-decoration: underline;
        }

        /* ===== 신고 =====
           눈에 잘 띄면 홧김에 누르고, 너무 숨기면 정작 필요할 때 못 찾는다.
           평소엔 배경색과 가깝게 두고 hover에서만 또렷해지게 했다. */
        .btn-report {
            flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px;
            display: inline-flex; align-items: center; justify-content: center;
            background: transparent; border: 1px solid rgba(255,255,255,0.05);
            color: #475569; cursor: pointer; transition: all 0.15s;
        }
        .btn-report:hover { border-color: rgba(252,129,129,0.4); color: #FC8181; }
        .btn-report svg { width: 12px; height: 12px; }
        .btn-report.done { color: var(--mint); border-color: rgba(79,209,197,0.35); cursor: default; }
        .cmt .btn-report { width: 22px; height: 22px; border-radius: 6px; }
        .cmt .btn-report svg { width: 10px; height: 10px; }

        /* 신고 대화상자 */
        .rp-back {
            position: fixed; inset: 0; z-index: 60;
            background: rgba(8,13,26,0.62); backdrop-filter: blur(3px);
            display: flex; align-items: center; justify-content: center; padding: 20px;
            animation: rp-fade 0.15s ease;
        }
        @keyframes rp-fade { from { opacity: 0; } }
        .rp-box {
            width: 100%; max-width: 380px;
            background: #151E36; border: 1px solid rgba(255,159,67,0.2);
            border-radius: 18px; padding: 22px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            animation: rp-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes rp-in { from { opacity: 0; transform: translateY(10px) scale(0.98); } }
        .rp-box h3 { font-size: 15px; font-weight: 700; margin: 0 0 4px; color: var(--text-main); }
        .rp-box .rp-sub { font-size: 11.5px; color: #64748B; line-height: 1.6; margin: 0 0 16px; }
        .rp-quote {
            font-size: 12px; color: #94A3B8; line-height: 1.6;
            background: rgba(255,255,255,0.03); border-left: 2px solid rgba(255,159,67,0.3);
            border-radius: 0 8px 8px 0; padding: 9px 12px; margin-bottom: 16px;
            max-height: 72px; overflow: hidden; word-break: break-word;
        }
        .rp-reasons { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .rp-reason {
            display: flex; align-items: center; gap: 9px; cursor: pointer;
            padding: 9px 12px; border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);
            font-size: 12.5px; color: #CBD5E1; transition: all 0.12s;
        }
        .rp-reason:hover { border-color: rgba(255,159,67,0.3); }
        .rp-reason input { accent-color: var(--accent); flex-shrink: 0; margin: 0; }
        .rp-reason.on { border-color: var(--accent); background: rgba(255,159,67,0.08); color: var(--accent); }
        .rp-detail {
            width: 100%; background: rgba(15,23,42,0.5);
            border: 1px solid rgba(255,159,67,0.18); border-radius: 10px;
            padding: 9px 12px; color: var(--text-main);
            font-family: 'Pretendard'; font-size: 12.5px; outline: none;
            margin-bottom: 14px; resize: vertical; min-height: 54px;
        }
        .rp-detail:focus { border-color: var(--accent); }
        @media (max-width: 768px) { .rp-detail { font-size: 16px; } }
        .rp-acts { display: flex; gap: 8px; }
        .rp-acts button {
            flex: 1; padding: 10px; border-radius: 10px; cursor: pointer;
            font-family: 'Pretendard'; font-size: 12.5px; font-weight: 700; transition: 0.2s;
        }
        .rp-cancel { background: transparent; color: #94A3B8; border: 1px solid rgba(255,255,255,0.08); }
        .rp-cancel:hover { color: var(--text-main); }
        .rp-send { background: #FC8181; color: #2A0F0F; border: none; }
        .rp-send:hover { opacity: 0.88; }
        .rp-send:disabled { opacity: 0.35; cursor: default; }

        .empty-state {
            text-align: center; padding: 40px 0; color: #64748B; font-size: 13px;
        }
        .empty-state p { margin: 0; line-height: 1.6; }

        @media (max-width: 768px) {
            header h1 { font-size: 1.7rem; }
            .container { margin-top: 110px; }
        }

        ::selection { background-color: #4FD1C5; color: #0F172A; }

        /* ===== 공통 푸터 ===== */

        /* 메인 패널에 iframe으로 임베드될 때 */
        .embed nav { display: none; }
        .embed .container { margin-top: 28px; }
        .embed .site-footer { display: none; }
        /* 메인의 패널 제목이 이미 "글 남기기"라 제목·소개가 그대로 한 번 더 나온다.
           단독 페이지에서는 검색과 첫인상에 필요하므로 남기고, 임베드일 때만 접는다.
           상태 배지(#loungeStatus)는 오류를 알리는 자리라 계속 보여야 한다. */
        .embed header h1,
        .embed header p { display: none; }
        .embed .mock-badge { margin-top: 0; }
    </style>
    <script>if(new URLSearchParams(location.search).get('embed'))document.documentElement.classList.add('embed');</script>
    <script src="effects.js" defer></script>
</head>
<body>
    <div class="bg-glow"></div>

    <nav class="site-topbar">
        <a class="logo" href="index.html">ORBIT.</a>
        <button class="nav-back" onclick="location.href='main.html'">← 커뮤니티 홈</button>
    </nav>

    <main class="container">
        <header>
            <div class="header-text">
                <h1>글 <span>남기기</span></h1>
                <p>어젯밤 뭘 보셨나요 — 같은 하늘을 본 사람들에게 남겨보세요</p>
                <span class="mock-badge" id="loungeStatus">β 베타 — 궤적은 모두에게 공개 저장돼요</span>
            </div>
        </header>

        <div class="orbit-tabs" id="orbitTabs"><!-- 채널 탭은 JS가 ORBIT_LIST로 채웁니다 --></div>

        <div class="channel-header" id="channelHeader"></div>

        <div class="write-card" id="writeCard">
            <!-- 가입 상태에 따라 JS가 채움 -->
        </div>

        <section id="postList"></section>
    </main>

    <footer class="site-footer">
        <div class="foot-links">
            <a href="main.html">커뮤니티 홈</a>
            <a href="sky.html">밤하늘 달력</a>
            <a href="lounge.html">글 남기기</a>
            <a href="terms.html">이용약관</a>
            <a href="privacy.html">개인정보처리방침</a>
        </div>
        <div class="foot-sign">
            © 2026 Orbit · Made with
            <svg class="foot-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M 50 15 L 62 34 L 83 39 L 69 56 L 71 78 L 50 70 L 29 78 L 31 56 L 17 39 L 38 34 Z" fill="#FF9F43" stroke="#FF9F43" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/></svg>
            in orbit
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script>
    // ===== Supabase =====
    var SB_URL = 'https://unwxpuvfqyjhgrcrmuhu.supabase.co';
    var SB_KEY = 'sb_publishable_KnyriHKUHNWw0QyIAXBmOA_0KaHPcXI'; // 공개용 키 (publishable)
    var sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;

    // ===== 기본 데이터 =====
    // ===== 채널(궤도) 단일 설정 — 여기 한 줄만 추가하면 새 채널이 생깁니다 =====
    // 2026-08 개편: 잡담형 채널(자유·재테크·운동·반려동물)을 관측 주제로 갈아끼웠다.
    // 옛 id(free/money/dawn/pet)를 재사용하지 않고 새 id를 쓴다 — 재사용하면 예전
    // 재테크 글이 '장비'처럼 엉뚱한 이름표를 달게 된다. 옛 글은 아래 orbitInfo의
    // 폴백을 타서 🛰️ 칩으로 그대로 보인다.
    //
    // 새 궤도를 더할 때는 DB의 posts_orbit_check 제약도 같이 풀어야 한다.
    // (supabase/migration_008_sky_orbits.sql 참고) 안 그러면 글 작성이 23514로 막힌다.
    var ORBIT_LIST = [
        { id:'report', icon:'📝', label:'관측 후기',   desc:'어젯밤 뭘 보셨나요 — 관측 기록과 후기를 남기는 궤도예요.' },
        { id:'gear',   icon:'🔭', label:'장비',        desc:'망원경·쌍안경·적도의·카메라 — 장비 이야기를 나누는 궤도예요.' },
        { id:'live',   icon:'🌌', label:'실시간 하늘', desc:'지금 하늘이 어떤가요 — 구름·시상·오로라 속보를 바로 올리는 궤도예요.' },
        { id:'ask',    icon:'❓', label:'질문',        desc:'뭐부터 봐야 할지, 저건 뭔지 — 무엇이든 물어보는 궤도예요.' }
    ];
    var ALL_ORBIT = { id:'all', icon:'🌠', label:'전체', desc:'모든 궤도의 궤적이 한데 흐르는 곳이에요.' };
    // 호환용 파생 맵 / 조회 헬퍼
    var ORBITS = {};
    ORBIT_LIST.forEach(function(o){ ORBITS[o.id] = o.label; });
    function orbitInfo(id){
        if(id === 'all') return ALL_ORBIT;
        for(var i=0;i<ORBIT_LIST.length;i++){ if(ORBIT_LIST[i].id === id) return ORBIT_LIST[i]; }
        return { id:id, icon:'🛰️', label:id, desc:'' }; // 사라진 옛 채널의 글도 깨지지 않게
    }
    var RX_EMOJIS = ['⭐','🔥','😂','🥰','👏','❤️'];
    var EMOJIS = ['🌟','⭐','🪐','🌙','☄️','🔭','🛸','💫','🌌','✨'];
    function avatarOf(nick){ return EMOJIS[nick.charCodeAt(0) % EMOJIS.length]; }

    var nickname = localStorage.getItem('orbit_nickname');
    var currentOrbit = 'all';
    var EMBED = document.documentElement.classList.contains('embed');

    // 관리자 모드. 로그인만으로는 켜지지 않고 admins 테이블에 등록된 계정이어야 한다.
    // 여기서 true여도 실제 삭제를 허용하는 건 서버의 RLS라서,
    // 이 값을 브라우저에서 조작해도 남의 글은 지워지지 않는다. 버튼 표시용일 뿐이다.
    var isAdmin = false;

    // 닉네임을 정하는 곳은 main.html의 진입 대화상자 하나뿐이다.
    // 임베드(메인 패널 안)일 땐 부모에게 열어달라고 요청하고,
    // 단독 페이지일 땐 #join 해시를 달고 넘어간다 — main.html이 그 해시를 보고 연다.
    function goJoin(){
        if(EMBED && window.parent !== window){ window.parent.postMessage({ orbit: 'join' }, window.location.origin); }
        else { location.href = 'main.html#join'; }
    }

    // 익명 리액션 식별용 기기 ID
    var deviceId = localStorage.getItem('orbit_device_id');
    if(!deviceId){
        deviceId = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now() + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem('orbit_device_id', deviceId);
    }

    // 리액션 캐시: { postId: {emoji: count} } / 내 리액션: { postId: {emoji: true} }
    var rxCount = {}, rxMine = {};

    // 댓글 캐시: { postId: [댓글...] } — 글 목록과 함께 한 번에 받아둔다
    var cmts = {};
    // 펼쳐 둔 댓글창: { postId: true }
    // 새로고침해도 보고 있던 스레드가 접히지 않도록 렌더 사이에 남긴다.
    var openThreads = {};

    function escapeHtml(s){
        // 작은따옴표까지 막는다. 지금은 모든 속성을 큰따옴표로 쓰지만,
        // 나중에 title='...' 같은 걸 한 줄 쓰는 순간 구멍이 되기 때문에 미리 닫아둔다.
        return String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function timeAgo(iso){
        var s = (Date.now() - new Date(iso).getTime()) / 1000;
        if(s < 60) return '방금 전';
        if(s < 3600) return Math.floor(s/60) + '분 전';
        if(s < 86400) return Math.floor(s/3600) + '시간 전';
        if(s < 86400*7) return Math.floor(s/86400) + '일 전';
        return new Date(iso).toLocaleDateString('ko-KR');
    }
    function setStatus(t, isErr){
        var el = document.getElementById('loungeStatus');
        el.textContent = t;
        el.style.color = isErr ? '#FC8181' : '';
        el.style.borderColor = isErr ? 'rgba(252,129,129,0.35)' : '';
    }

    // ===== 글쓰기 카드 =====
    function renderWriteCard(){
        var card = document.getElementById('writeCard');
        if(!nickname){
            card.innerHTML =
                '<div class="need-join">' +
                '<p>궤도에 진입하면 궤적을 남길 수 있어요</p>' +
                '<button class="btn-go-join" onclick="goJoin()">궤도 진입하러 가기</button>' +
                '</div>';
            return;
        }
        var orbitOptions = ORBIT_LIST.map(function(o){
            return '<option value="' + o.id + '">' + o.icon + ' ' + escapeHtml(o.label) + '</option>';
        }).join('');
        card.innerHTML =
            '<div class="write-head">' +
            '<div class="write-avatar">' + avatarOf(nickname) + '</div>' +
            '<div class="write-nick">' + escapeHtml(nickname) + '</div>' +
            '<select class="write-orbit-select" id="orbitSelect">' + orbitOptions + '</select>' +
            '</div>' +
            '<textarea id="postInput" maxlength="500" placeholder="오늘 어떤 궤적을 남기실 건가요?"></textarea>' +
            '<div class="write-foot">' +
            '<span class="write-count" id="charCount">0 / 500</span>' +
            '<button class="btn-trace" id="btnTrace" disabled>궤적 남기기</button>' +
            '</div>';

        // 지금 보고 있는 채널을 기본 선택 — "이 방에 글 쓴다" 느낌
        var sel = document.getElementById('orbitSelect');
        if(sel && currentOrbit !== 'all') sel.value = currentOrbit;

        var input = document.getElementById('postInput');
        var btn = document.getElementById('btnTrace');
        input.addEventListener('input', function(){
            document.getElementById('charCount').textContent = input.value.length + ' / 500';
            btn.disabled = input.value.trim().length === 0;
        });
        btn.addEventListener('click', async function(){
            var text = input.value.trim();
            if(!text || !sb || btn.dataset.sending) return;
            btn.dataset.sending = '1';
            btn.disabled = true;
            btn.textContent = '남기는 중...';
            var res = await sb.from('posts').insert({
                nick: nickname,
                orbit: document.getElementById('orbitSelect').value,
                text: text,
                author_device: deviceId
            });
            delete btn.dataset.sending;
            btn.textContent = '궤적 남기기';
            if(res.error){
                btn.disabled = false;
                setStatus('전송 실패 — ' + errHint(res.error), true);
                console.error(res.error);
            } else {
                input.value = '';
                document.getElementById('charCount').textContent = '0 / 500';
                setStatus('β 베타 — 궤적은 모두에게 공개 저장돼요');
                loadPosts({ quiet: true });   // 목록을 로딩 문구로 비웠다 채우지 않게
            }
        });
    }

    // ===== 글 불러오기 =====
    // opts.quiet — 새로고침처럼 이미 보고 있는 목록을 갱신하는 경우.
    // 로딩 문구로 목록을 지우지 않고, 실패해도 보던 궤적을 남겨둔다.
    async function loadPosts(opts){
        var quiet = !!(opts && opts.quiet);
        var list = document.getElementById('postList');
        if(!sb){
            list.innerHTML = '<div class="empty-state">서버 연결 모듈을 불러오지 못했어요.<br>새로고침 해주세요.</div>';
            setStatus('연결 실패 — 새로고침 해주세요', true);
            return;
        }
        if(!quiet) list.innerHTML = '<div class="empty-state">궤적을 불러오는 중...</div>';
        try {
            var q = sb.from('posts').select('*').order('created_at', { ascending: false }).limit(50);
            if(currentOrbit !== 'all') q = q.eq('orbit', currentOrbit);
            var res = await q;
            if(res.error) throw res.error;
            var posts = res.data || [];

            rxCount = {}; rxMine = {}; cmts = {};
            if(posts.length){
                var ids = posts.map(function(p){ return p.id; });
                // 예전에는 reactions 행을 통째로 받아 device_id를 직접 비교했다.
                // 그러면 남의 기기 ID가 모두 노출돼 그 값으로 남의 리액션을 지울 수 있었다.
                // 이제 서버가 개수와 "내가 눌렀는지"만 계산해서 돌려준다.
                var r = await sb.rpc('reaction_summary', { p_post_ids: ids, p_device: deviceId });
                if(r.error) throw r.error;
                (r.data || []).forEach(function(row){
                    (rxCount[row.post_id] = rxCount[row.post_id] || {})[row.emoji] = Number(row.n) || 0;
                    if(row.mine){
                        (rxMine[row.post_id] = rxMine[row.post_id] || {})[row.emoji] = true;
                    }
                });

                // 댓글도 한 번에 받아둔다 — 펼칠 때마다 요청하면 반응이 굼뜨다.
                // limit는 안전장치다. 여기 걸릴 만큼 댓글이 쌓이면
                // 개수만 세는 조회와 본문 조회를 나누는 게 다음 단계.
                var cm = await sb.from('comments').select('*')
                    .in('post_id', ids).order('created_at', { ascending: true }).limit(500);
                if(cm.error) throw cm.error;
                (cm.data || []).forEach(function(row){
                    (cmts[row.post_id] = cmts[row.post_id] || []).push(row);
                });
            }
            renderPosts(posts, quiet);
        } catch(err){
            console.error(err);
            // 조용한 갱신이 실패했을 때 목록을 에러 문구로 갈아치우면
            // 잘 보고 있던 궤적이 통째로 사라진다 — 상태 배지로만 알린다.
            if(quiet) setStatus('새로고침 실패 — ' + errHint(err), true);
            else list.innerHTML = '<div class="empty-state">광장을 불러오지 못했어요.<br>' + escapeHtml(errHint(err)) + '</div>';
        }
    }

    // 에러를 사람이 읽을 수 있는 힌트로 — 원인 파악용
    function errHint(err){
        if(!err) return '알 수 없는 오류';
        var m = (err.message || '') + '';
        if(/orbit_report_rate_limit/i.test(m))
            return '신고를 너무 빠르게 보내고 있어요 — 잠시 후 다시 시도해주세요';
        if(/orbit_comment_rate_limit/i.test(m))
            return '답을 너무 빠르게 남기고 있어요 — 잠시 쉬었다가 다시 남겨주세요';
        if(/orbit_rate_limit/i.test(m))
            return '궤적을 너무 빠르게 남기고 있어요 — 잠시 쉬었다가 다시 남겨주세요';
        if(/Failed to fetch|NetworkError|Load failed/i.test(m))
            return '서버에 연결할 수 없어요 (프로젝트가 일시정지됐거나 네트워크 문제)';
        if(err.code === '42501' || /row-level security/i.test(m))
            return '서버 권한 설정(RLS) 문제예요';
        if(err.code === '23514' || /check constraint/i.test(m))
            return '입력값이 규칙에 맞지 않아요 (닉네임 2~12자, 글 1~500자)';
        if(/JWT|api key|Invalid authentication/i.test(m))
            return 'API 키 인증 문제예요';
        return m.slice(0, 80) || ('오류 코드 ' + (err.code || err.status || '?'));
    }

    // quiet일 때는 등장 애니메이션을 생략한다. 새로고침마다 목록 전체가
    // 다시 떠오르면 바뀐 게 없어도 화면이 요동쳐서 오히려 어수선하다.
    function renderPosts(posts, quiet){
        var list = document.getElementById('postList');
        list.innerHTML = '';
        if(posts.length === 0){
            list.innerHTML = '<div class="empty-state"><p>아직 이 궤도에는 궤적이 없어요.<br>첫 번째 궤적을 남겨보세요!</p></div>';
            return;
        }
        posts.forEach(function(p, i){
            // "나"는 닉네임이 아니라 작성 기기로 판단한다.
            // 닉네임은 자유 입력이라 남이 같은 닉을 쓰면 그 사람 글에 '나' 배지가 붙는다.
            // 삭제 권한이 이미 쓰고 있던 기준(author_device)과 하나로 맞췄다.
            var isMine = !!(p.author_device && p.author_device === deviceId);
            var canDelete = isMine || isAdmin;
            var post = document.createElement('article');
            post.className = 'post';
            if(quiet) post.style.animation = 'none';
            else post.style.animationDelay = (Math.min(i, 10) * 0.05) + 's';
            post.innerHTML =
                '<div class="post-head">' +
                '<div class="post-avatar">' + avatarOf(p.nick) + '</div>' +
                '<div class="post-meta">' +
                '<div class="post-nick">' + escapeHtml(p.nick) + (isMine ? ' <span style="font-size:9px;color:#9F7AEA;">나</span>' : '') + '</div>' +
                '<div class="post-sub">' + timeAgo(p.created_at) + '</div>' +
                '</div>' +
                '<span class="post-orbit-chip' + (isMine?' mine':'') + '">' + orbitInfo(p.orbit).icon + ' ' + escapeHtml(orbitInfo(p.orbit).label) + '</span>' +
                '</div>' +
                '<div class="post-body">' + escapeHtml(p.text) + '</div>' +
                '<div class="post-foot">' +
                '<div class="reaction-row"></div>' +
                '<button class="btn-cmt' + (openThreads[p.id] ? ' on' : '') + '" type="button" title="댓글">' +
                '<span>💬</span><span class="cn">' + (cmts[p.id] || []).length + '</span></button>' +
                // 내 글은 신고할 이유가 없다 — 지우면 되니까
                (isMine ? '' : reportBtn('post', p.id)) +
                (canDelete ? '<button class="btn-del" title="궤적 삭제"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button>' : '') +
                '</div>' +
                '<div class="cmt-thread"' + (openThreads[p.id] ? '' : ' style="display:none;"') + '></div>';
            list.appendChild(post);
            renderRxRow(post.querySelector('.reaction-row'), p);
            if(canDelete){
                post.querySelector('.btn-del').addEventListener('click', function(){ deletePost(p, post); });
            }

            var btnCmt = post.querySelector('.btn-cmt');
            btnCmt.addEventListener('click', function(){
                var open = !openThreads[p.id];
                if(open) openThreads[p.id] = true; else delete openThreads[p.id];
                btnCmt.classList.toggle('on', open);
                post.querySelector('.cmt-thread').style.display = open ? '' : 'none';
                if(open) renderThread(post, p);
            });
            // 새로고침 전에 펼쳐져 있던 스레드는 그대로 열어둔 채로 그린다
            if(openThreads[p.id]) renderThread(post, p);
        });
    }

    // ===== 신고 =====
    var REPORT_REASONS = [
        { id:'spam',    label:'도배 · 광고' },
        { id:'abuse',   label:'욕설 · 비방' },
        { id:'adult',   label:'선정적이거나 불쾌한 내용' },
        { id:'privacy', label:'개인정보 노출' },
        { id:'etc',     label:'기타' }
    ];
    // 이 기기가 이번 세션에서 신고한 대상 — 버튼을 눌린 상태로 유지한다.
    // 서버에도 (대상, 기기) 유니크 제약이 있어 중복은 어차피 막힌다.
    var reported = {};

    var FLAG_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>';

    function reportBtn(type, id){
        var done = reported[type + ':' + id];
        return '<button class="btn-report' + (done ? ' done' : '') + '" type="button"' +
               ' data-rp-type="' + type + '" data-rp-id="' + escapeHtml(id) + '"' +
               ' title="' + (done ? '신고함' : '신고하기') + '">' + FLAG_ICON + '</button>';
    }

    // 신고 버튼은 글·답 어디에나 있고 목록이 다시 그려지므로 문서 단위로 위임한다
    document.addEventListener('click', function(e){
        var btn = e.target.closest('.btn-report');
        if(!btn || btn.classList.contains('done')) return;
        e.stopPropagation();
        var type = btn.getAttribute('data-rp-type');
        var id   = btn.getAttribute('data-rp-id');
        var box  = btn.closest(type === 'post' ? '.post' : '.cmt');
        var body = box ? box.querySelector(type === 'post' ? '.post-body' : '.cmt-body') : null;
        openReport(type, id, body ? body.textContent : '', btn);
    });

    function openReport(type, id, quote, btn){
        var back = document.createElement('div');
        back.className = 'rp-back';
        back.innerHTML =
            '<div class="rp-box" role="dialog" aria-modal="true" aria-label="신고하기">' +
            '<h3>이 ' + (type === 'post' ? '궤적' : '답') + '을 신고할까요?</h3>' +
            '<p class="rp-sub">운영자가 확인한 뒤 조치합니다. 신고한 사람이 누구인지는 공개되지 않아요.</p>' +
            (quote ? '<div class="rp-quote">' + escapeHtml(quote.slice(0, 120)) +
                     (quote.length > 120 ? '…' : '') + '</div>' : '') +
            '<div class="rp-reasons">' +
            REPORT_REASONS.map(function(r, i){
                return '<label class="rp-reason' + (i === 0 ? ' on' : '') + '">' +
                       '<input type="radio" name="rp" value="' + r.id + '"' + (i === 0 ? ' checked' : '') + '>' +
                       escapeHtml(r.label) + '</label>';
            }).join('') +
            '</div>' +
            '<textarea class="rp-detail" maxlength="200" placeholder="덧붙일 말이 있다면 적어주세요 (선택)"></textarea>' +
            '<div class="rp-acts">' +
            '<button class="rp-cancel" type="button">취소</button>' +
            '<button class="rp-send" type="button">신고하기</button>' +
            '</div></div>';
        document.body.appendChild(back);

        var close = function(){ back.remove(); document.removeEventListener('keydown', onKey); };
        function onKey(ev){ if(ev.key === 'Escape') close(); }
        document.addEventListener('keydown', onKey);
        back.addEventListener('click', function(ev){ if(ev.target === back) close(); });
        back.querySelector('.rp-cancel').addEventListener('click', close);

        // 라디오 선택 표시
        back.querySelectorAll('.rp-reason').forEach(function(l){
            l.addEventListener('click', function(){
                back.querySelectorAll('.rp-reason').forEach(function(x){ x.classList.remove('on'); });
                l.classList.add('on');
            });
        });

        var send = back.querySelector('.rp-send');
        send.addEventListener('click', async function(){
            if(!sb || send.dataset.busy) return;
            send.dataset.busy = '1'; send.disabled = true; send.textContent = '보내는 중...';
            var reason = back.querySelector('input[name="rp"]:checked').value;
            var detail = back.querySelector('.rp-detail').value.trim();
            var res = await sb.from('reports').insert({
                target_type: type, target_id: id, reason: reason,
                detail: detail || null, reporter_device: deviceId
            });
            delete send.dataset.busy;

            // 유니크 제약(23505) = 이미 신고한 대상. 실패가 아니라 이미 접수된 상태다.
            if(res.error && res.error.code !== '23505'){
                send.disabled = false; send.textContent = '신고하기';
                setStatus('신고 실패 — ' + errHint(res.error), true);
                console.error(res.error);
                return;
            }
            reported[type + ':' + id] = true;
            if(btn){ btn.classList.add('done'); btn.title = '신고함'; }
            close();
            setStatus(res.error ? '이미 신고한 ' + (type === 'post' ? '궤적' : '답') + '이에요'
                                : '신고를 접수했어요. 확인 후 조치할게요');
        });
    }

    // ===== 댓글 =====
    function renderThread(post, p){
        var thread = post.querySelector('.cmt-thread');
        var list = cmts[p.id] || [];
        var html = '';

        if(!list.length){
            html += '<div class="cmt-empty">아직 답이 없어요. 첫 답을 남겨보세요.</div>';
        } else {
            html += '<div class="cmt-list">';
            list.forEach(function(c){
                // '나' 배지는 내가 쓴 것에만, 삭제 버튼은 내 것 + 관리자.
                // 둘을 한 변수로 묶으면 관리자에게 남의 답이 전부 '나'로 보인다.
                var own = !!(c.author_device && c.author_device === deviceId);
                var canDel = own || isAdmin;
                html +=
                    '<div class="cmt" data-cid="' + escapeHtml(c.id) + '">' +
                    '<div class="cmt-av">' + avatarOf(c.nick) + '</div>' +
                    '<div class="cmt-main">' +
                    '<div class="cmt-meta">' +
                    '<span class="cmt-nick">' + escapeHtml(c.nick) + '</span>' +
                    (own ? '<span class="cmt-me">나</span>' : '') +
                    '<span class="cmt-time">' + timeAgo(c.created_at) + '</span>' +
                    '</div>' +
                    '<div class="cmt-body">' + escapeHtml(c.text) + '</div>' +
                    '</div>' +
                    (own ? '' : reportBtn('comment', c.id)) +
                    (canDel ? '<button class="btn-cmt-del" type="button" title="' +
                              (own ? '답 삭제' : '관리자 삭제') + '"' +
                              (own ? '' : ' data-admin="1"') + '>×</button>' : '') +
                    '</div>';
            });
            html += '</div>';
        }

        html += nickname
            ? '<div class="cmt-write">' +
              '<input type="text" maxlength="300" placeholder="답을 남겨보세요">' +
              '<button class="btn-cmt-send" type="button" disabled>등록</button>' +
              '</div>'
            : '<div class="cmt-need-join">궤도에 진입하면 답을 남길 수 있어요 · ' +
              '<button type="button" class="cmt-join">궤도 진입하러 가기</button></div>';

        thread.innerHTML = html;
        wireThread(post, p, thread);
    }

    function wireThread(post, p, thread){
        var input = thread.querySelector('.cmt-write input');
        var send  = thread.querySelector('.btn-cmt-send');
        if(input && send){
            input.addEventListener('input', function(){
                send.disabled = input.value.trim().length === 0;
            });
            input.addEventListener('keydown', function(e){
                if(e.key === 'Enter' && !send.disabled) send.click();
            });
            send.addEventListener('click', function(){ submitComment(p, post, input, send); });
        }
        var join = thread.querySelector('.cmt-join');
        if(join) join.addEventListener('click', goJoin);

        thread.querySelectorAll('.btn-cmt-del').forEach(function(b){
            b.addEventListener('click', function(){
                deleteComment(p, post, b.closest('.cmt').getAttribute('data-cid'),
                              b.hasAttribute('data-admin'));
            });
        });
    }

    // 이 글의 댓글만 다시 받아 스레드와 개수를 갱신한다 (전체 목록은 건드리지 않음)
    async function refreshThread(p, post){
        try {
            var r = await sb.from('comments').select('*')
                .eq('post_id', p.id).order('created_at', { ascending: true }).limit(500);
            if(r.error) throw r.error;
            cmts[p.id] = r.data || [];
        } catch(err){
            console.error(err);
            setStatus('댓글을 불러오지 못했어요 — ' + errHint(err), true);
            return;
        }
        var cn = post.querySelector('.btn-cmt .cn');
        if(cn) cn.textContent = (cmts[p.id] || []).length;
        renderThread(post, p);
    }

    async function submitComment(p, post, input, send){
        var text = input.value.trim();
        if(!text || !sb || send.dataset.sending) return;
        send.dataset.sending = '1';
        send.disabled = true;
        send.textContent = '...';
        var res = await sb.from('comments').insert({
            post_id: p.id, nick: nickname, text: text, author_device: deviceId
        });
        delete send.dataset.sending;
        send.textContent = '등록';
        if(res.error){
            send.disabled = false;
            setStatus('전송 실패 — ' + errHint(res.error), true);
            console.error(res.error);
            return;
        }
        input.value = '';
        await refreshThread(p, post);
    }

    async function deleteComment(p, post, cid, asAdmin){
        if(!sb || !cid) return;
        if(!confirm(asAdmin ? '[관리자] 이 답을 삭제할까요? 되돌릴 수 없어요.'
                            : '이 답을 삭제할까요? 되돌릴 수 없어요.')) return;
        var res = asAdmin
            ? await sb.from('comments').delete().eq('id', cid)
            : await sb.rpc('delete_comment', { p_id: cid, p_device: deviceId });
        if(res.error){
            console.error(res.error);
            setStatus('삭제 실패 — 잠시 후 다시 시도해주세요', true);
            return;
        }
        await refreshThread(p, post);
    }

    // ===== 궤적 삭제 (작성한 기기 또는 관리자) =====
    // 내 글은 기기를 확인하는 RPC로, 관리자는 REST delete로 지운다.
    // 관리자 경로가 통과되는 근거는 서버의 RLS 정책(is_admin())이지
    // 아래 isAdmin 변수가 아니다 — 변수는 어느 요청을 보낼지만 고른다.
    async function deletePost(p, el){
        if(!sb) return;
        var mine = !!(p.author_device && p.author_device === deviceId);
        if(!confirm(mine ? '이 궤적을 삭제할까요? 되돌릴 수 없어요.'
                         : '[관리자] ' + p.nick + ' 님의 궤적을 삭제할까요? 되돌릴 수 없어요.')) return;
        var res = mine
            ? await sb.rpc('delete_post', { p_id: p.id, p_device: deviceId })
            : await sb.from('posts').delete().eq('id', p.id);
        if(res.error){
            console.error(res.error);
            setStatus('삭제 실패 — 잠시 후 다시 시도해주세요', true);
            return;
        }
        el.style.transition = 'opacity 0.25s, transform 0.25s';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(function(){ loadPosts({ quiet: true }); }, 250);
    }

    // ===== 이모지 교차 리액션 =====
    function renderRxRow(row, p){
        var mine = rxMine[p.id] || {};
        var counts = rxCount[p.id] || {};
        var keys = Object.keys(counts).filter(function(e){ return counts[e] > 0; });

        row.innerHTML = '';
        keys.forEach(function(emo){
            var chip = document.createElement('button');
            chip.className = 'rx-chip' + (mine[emo] ? ' mine' : '');
            chip.innerHTML = '<span>' + emo + '</span><span class="n">' + counts[emo] + '</span>';
            chip.addEventListener('click', function(ev){
                ev.stopPropagation();
                toggleRx(p, emo, row);
            });
            row.appendChild(chip);
        });

        var add = document.createElement('button');
        add.className = 'rx-add';
        add.textContent = '+';
        add.title = '교차 남기기';
        add.addEventListener('click', function(ev){
            ev.stopPropagation();
            togglePalette(row, p);
        });
        row.appendChild(add);
    }

    async function toggleRx(p, emo, row){
        if(!sb) return;
        var mine = rxMine[p.id] = rxMine[p.id] || {};
        var counts = rxCount[p.id] = rxCount[p.id] || {};
        var turningOn = !mine[emo];

        // 낙관적 업데이트 — 실패 시 롤백
        if(turningOn){ mine[emo] = true; counts[emo] = (counts[emo] || 0) + 1; }
        else { delete mine[emo]; counts[emo] = Math.max(0, (counts[emo] || 1) - 1); }
        renderRxRow(row, p);

        // 취소는 REST delete가 아니라 RPC로 한다 — 정책이 관리자에게만 열려 있고,
        // 이 함수가 기기가 일치하는 행만 지운다.
        var res = turningOn
            ? await sb.from('reactions').insert({ post_id: p.id, emoji: emo, device_id: deviceId })
            : await sb.rpc('delete_reaction', { p_post_id: p.id, p_emoji: emo, p_device: deviceId });

        if(res.error){
            console.error(res.error);
            if(turningOn){ delete mine[emo]; counts[emo] = Math.max(0, counts[emo] - 1); }
            else { mine[emo] = true; counts[emo] = (counts[emo] || 0) + 1; }
            renderRxRow(row, p);
        }
    }

    var openPal = null;
    function closePalette(){ if(openPal){ openPal.remove(); openPal = null; } }
    function togglePalette(row, p){
        if(openPal && openPal.parentNode === row){ closePalette(); return; }
        closePalette();
        var pal = document.createElement('div');
        pal.className = 'rx-palette';
        RX_EMOJIS.forEach(function(emo){
            var b = document.createElement('button');
            b.className = 'rx-pal-btn';
            b.textContent = emo;
            b.addEventListener('click', function(ev){
                ev.stopPropagation();
                closePalette();
                toggleRx(p, emo, row);
            });
            pal.appendChild(b);
        });
        row.appendChild(pal);
        openPal = pal;
    }
    document.addEventListener('click', closePalette);

    // ===== 궤도(채널) 탭 =====
    function renderOrbitTabs(){
        var html = '<button class="orbit-tab' + (currentOrbit==='all'?' on':'') +
                   '" data-orbit="all"><span class="ic">' + ALL_ORBIT.icon + '</span> 전체</button>';
        ORBIT_LIST.forEach(function(o){
            html += '<button class="orbit-tab' + (currentOrbit===o.id?' on':'') +
                    '" data-orbit="' + o.id + '"><span class="ic">' + o.icon + '</span> ' + escapeHtml(o.label) + '</button>';
        });
        document.getElementById('orbitTabs').innerHTML = html;
    }
    var REFRESH_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>' +
        '<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/>' +
        '</svg>';

    function renderChannelHeader(){
        var o = orbitInfo(currentOrbit);
        document.getElementById('channelHeader').innerHTML =
            '<div class="ch-icon">' + o.icon + '</div>' +
            '<div class="ch-text">' +
            '<div class="ch-name">' + escapeHtml(o.label) + '</div>' +
            '<div class="ch-desc">' + escapeHtml(o.desc) + '</div>' +
            '</div>' +
            '<button class="btn-refresh" type="button" title="새 궤적 불러오기">' +
            REFRESH_ICON + '<span class="rf-lbl">새로고침</span></button>';
    }

    // 헤더는 채널을 바꿀 때마다 다시 그려지므로, 버튼에 직접 걸지 않고 위임한다
    document.getElementById('channelHeader').addEventListener('click', function(e){
        var btn = e.target.closest('.btn-refresh');
        if(!btn || btn.classList.contains('spin')) return;
        btn.classList.add('spin');
        // 최소 한 바퀴는 돌려준다 — 응답이 즉시 와도 "눌리긴 한 건가" 싶지 않게
        var started = Date.now();
        loadPosts({ quiet: true }).then(function(){
            setTimeout(function(){ btn.classList.remove('spin'); },
                       Math.max(0, 700 - (Date.now() - started)));
        });
    });

    document.getElementById('orbitTabs').addEventListener('click', function(e){
        var tab = e.target.closest('.orbit-tab');
        if(!tab) return;
        document.querySelectorAll('.orbit-tab').forEach(function(t){ t.classList.remove('on'); });
        tab.classList.add('on');
        currentOrbit = tab.getAttribute('data-orbit');
        renderChannelHeader();
        var sel = document.getElementById('orbitSelect');
        if(sel && currentOrbit !== 'all') sel.value = currentOrbit; // 보던 방으로 글쓰기 기본값 맞춤
        loadPosts();
    });

    // ===== 관리자 확인 =====
    // 로그인 세션이 있으면 admins에 등록된 계정인지 서버에 물어본다.
    // 등록돼 있으면 모든 궤적·답에 삭제 버튼이 붙는다.
    // 실패하거나 세션이 없으면 그냥 일반 사용자로 둔다 — 광장은 그대로 동작한다.
    async function checkAdmin(){
        if(!sb || !sb.auth) return false;
        try {
            var s = await sb.auth.getSession();
            if(!s.data || !s.data.session) return false;
            var r = await sb.rpc('is_admin');
            return !r.error && r.data === true;
        } catch(e){ return false; }
    }

    function showAdminBadge(){
        var el = document.getElementById('loungeStatus');
        el.textContent = '🛰️ 관리자 모드 — 모든 궤적과 답을 지울 수 있어요';
        el.style.color = 'var(--mint)';
        el.style.borderColor = 'rgba(79,209,197,0.35)';
        el.style.background = 'rgba(79,209,197,0.08)';
    }

    renderOrbitTabs();
    renderChannelHeader();
    renderWriteCard();

    // 관리자 확인이 끝난 뒤에 목록을 그린다 — 먼저 그리면 삭제 버튼이 한 박자 늦게 나타난다.
    checkAdmin().then(function(ok){
        isAdmin = ok;
        if(ok) showAdminBadge();
        loadPosts();
    });
    </script>
</body>
</html>
````


## `admin.html`

> 560줄 · 34969바이트

관제실. Supabase Auth 로그인 후 is_admin()으로 권한을 확인하고, 통과하면 신고함(report_queue / resolve_report)과 업데이트 기록(v0.1~v1.5 정적 타임라인)을 연다. 사이트 어디에도 링크가 없고 noindex + robots Disallow.

````html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orbit | 관제실</title>
    <!-- 검색에 잡히지 않게 한다. robots.txt에도 Disallow가 있고 sitemap에도 넣지 않는다.
         숨기는 게 보안은 아니지만(권한은 서버 RLS가 판정한다) 굳이 노출할 이유도 없다. -->
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#0F172A">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
    <link rel="stylesheet" href="/orbit.css">
    <style>
        .wrap { max-width: 420px; margin: 130px auto 80px; padding: 0 20px; }

        .panel {
            background: var(--card-bg);
            border: 1px solid rgba(255,159,67,0.15);
            border-radius: 20px; padding: 28px;
        }
        .panel h1 { font-size: 1.35rem; font-weight: 200; margin: 0 0 6px; }
        .panel h1 strong { color: var(--accent); font-weight: 700; }
        .panel .sub { font-size: 12.5px; color: #64748B; line-height: 1.6; margin: 0 0 22px; }

        .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .field label { font-size: 11px; color: #94A3B8; font-weight: 600; letter-spacing: 0.03em; }
        .field input {
            background: rgba(15,23,42,0.5);
            border: 1px solid rgba(255,159,67,0.25);
            border-radius: 12px; padding: 12px 14px;
            color: var(--text-main); font-family: 'Pretendard'; font-size: 14px;
            outline: none; transition: border-color 0.2s;
        }
        .field input:focus { border-color: var(--accent); }
        /* 모바일에서 16px 미만이면 iOS Safari가 포커스 순간 페이지를 자동 확대한다 */
        @media (max-width: 768px) { .field input { font-size: 16px; } }

        .btn-main {
            width: 100%; padding: 13px; margin-top: 4px;
            background: var(--accent); color: #0F172A; border: none; border-radius: 12px;
            font-family: 'Pretendard'; font-size: 14px; font-weight: 700;
            cursor: pointer; transition: 0.2s;
        }
        .btn-main:hover { opacity: 0.9; }
        .btn-main:disabled { opacity: 0.4; cursor: default; }

        .btn-line {
            display: block; width: 100%; padding: 11px; margin-top: 8px;
            background: transparent; color: #94A3B8; text-align: center; text-decoration: none;
            border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
            font-family: 'Pretendard'; font-size: 13px; font-weight: 600;
            cursor: pointer; transition: 0.2s;
        }
        .btn-line:hover { border-color: rgba(255,159,67,0.35); color: var(--accent); }

        .note {
            margin-top: 16px; padding: 12px 14px; border-radius: 12px;
            font-size: 12px; line-height: 1.65;
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
            color: #64748B;
        }
        .note.err { background: rgba(252,129,129,0.07); border-color: rgba(252,129,129,0.3); color: #FC8181; }
        .note.ok  { background: rgba(79,209,197,0.07); border-color: rgba(79,209,197,0.3); color: var(--mint); }
        .note:empty { display: none; }

        .who {
            display: flex; align-items: center; gap: 10px;
            padding: 13px 15px; border-radius: 14px; margin-bottom: 16px;
            background: rgba(255,159,67,0.08); border: 1px solid rgba(255,159,67,0.22);
        }
        .who .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--mint); flex-shrink: 0; }
        .who .txt { min-width: 0; }
        .who .t1 { font-size: 13px; font-weight: 700; color: var(--accent); }
        .who .t2 { font-size: 11px; color: #94A3B8; margin-top: 2px; word-break: break-all; }

        /* ===== 업데이트 기록 =====
           원래 main.html#updates 해시로만 열리던 숨은 탭이었다.
           숨김은 접근 제어가 아니라서 주소를 아는 사람은 누구나 볼 수 있었다.
           운영자용 기록이므로 로그인해야 보이는 이곳으로 옮겼다. */
        .log-panel { margin-top: 18px; }
        .log-panel > h2 {
            font-size: 12px; font-weight: 700; color: #94A3B8;
            letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 12px;
        }
        .update-card {
            background: var(--card-bg); border: 1px solid rgba(255,159,67,0.15);
            border-radius: 20px; padding: 22px;
        }
        .timeline { display: flex; flex-direction: column; gap: 0; margin-top: 8px; }
        .tl-item { display: flex; gap: 14px; padding-bottom: 22px; position: relative; }
        .tl-item:last-child { padding-bottom: 0; }
        .tl-left { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
        .tl-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 3px; box-shadow: 0 0 8px rgba(255,159,67,0.5); }
        .tl-dot.old { background: #334155; box-shadow: none; }
        .tl-line { width: 1px; flex: 1; margin-top: 4px; background: linear-gradient(to bottom, rgba(255,159,67,0.3), rgba(255,159,67,0.05)); }
        .tl-item:last-child .tl-line { display: none; }
        .tl-content { flex: 1; min-width: 0; }
        .tl-version { font-size: 11px; font-weight: 700; color: var(--accent); letter-spacing: 0.08em; margin-bottom: 3px; }
        .tl-version.old { color: #64748B; }
        .tl-date { font-size: 10px; color: #64748B; margin-bottom: 6px; }
        .tl-title { font-size: 14px; font-weight: 600; color: #CBD5E1; margin-bottom: 4px; }
        .tl-desc { font-size: 12px; color: #64748B; line-height: 1.5; }
        .tl-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
        .tl-tag { font-size: 10px; padding: 2px 7px; border-radius: 6px; background: rgba(255,159,67,0.08); color: #FF9F43; font-weight: 500; }
        .tl-tag.purple { background: rgba(159,122,234,0.1); color: #9F7AEA; }
        .tl-tag.gray { background: rgba(100,116,139,0.15); color: #64748B; }

        /* ===== 신고함 ===== */
        .rq-head { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; }
        .rq-head h2 {
            font-size: 12px; font-weight: 700; color: #94A3B8;
            letter-spacing: 0.06em; text-transform: uppercase; margin: 0;
        }
        .rq-count {
            font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 99px;
            background: rgba(252,129,129,0.12); color: #FC8181; border: 1px solid rgba(252,129,129,0.3);
        }
        .rq-count.zero { background: rgba(79,209,197,0.1); color: var(--mint); border-color: rgba(79,209,197,0.3); }
        .rq-empty { font-size: 12px; color: #64748B; padding: 14px 0; }
        .rq-list { display: flex; flex-direction: column; gap: 10px; }
        .rq-item {
            background: var(--card-bg); border: 1px solid rgba(252,129,129,0.22);
            border-radius: 14px; padding: 14px 16px;
        }
        .rq-item.handled { border-color: rgba(255,255,255,0.06); opacity: 0.55; }
        .rq-top { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 7px; }
        .rq-reason {
            font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 6px;
            background: rgba(252,129,129,0.12); color: #FC8181;
        }
        .rq-item.handled .rq-reason { background: rgba(100,116,139,0.15); color: #64748B; }
        .rq-kind { font-size: 10px; color: #64748B; }
        .rq-dup { font-size: 10px; color: var(--accent); font-weight: 700; }
        .rq-when { font-size: 10px; color: #64748B; margin-left: auto; }
        .rq-nick { font-size: 11.5px; color: #94A3B8; font-weight: 600; margin-bottom: 4px; }
        .rq-body {
            font-size: 12.5px; color: #CBD5E1; line-height: 1.6;
            white-space: pre-wrap; word-break: break-word;
            max-height: 88px; overflow: auto;
        }
        .rq-gone { font-size: 12px; color: #64748B; font-style: normal; }
        .rq-detail {
            margin-top: 7px; font-size: 11.5px; color: #94A3B8; line-height: 1.55;
            border-left: 2px solid rgba(255,159,67,0.25); padding-left: 9px;
        }
        .rq-acts { display: flex; gap: 6px; margin-top: 11px; }
        .rq-acts button {
            padding: 7px 12px; border-radius: 8px; cursor: pointer;
            font-family: 'Pretendard'; font-size: 11.5px; font-weight: 700; transition: 0.2s;
        }
        .rq-del { background: rgba(252,129,129,0.1); color: #FC8181; border: 1px solid rgba(252,129,129,0.35); }
        .rq-del:hover { background: rgba(252,129,129,0.2); }
        .rq-ok { background: transparent; color: #94A3B8; border: 1px solid rgba(255,255,255,0.08); }
        .rq-ok:hover { border-color: rgba(79,209,197,0.4); color: var(--mint); }
        .rq-acts button:disabled { opacity: 0.4; cursor: default; }

        /* 기록이 길어서 로그인 카드보다 넓게 쓴다 */
        @media (min-width: 720px) {
            .wrap:has(.log-panel:not([style*="none"])) { max-width: 660px; }
        }

        ::selection { background-color: #4FD1C5; color: #0F172A; }
    </style>
</head>
<body>
    <div class="bg-glow"></div>

    <nav class="site-topbar">
        <a class="logo" href="index.html">ORBIT.</a>
        <button class="nav-back" onclick="location.href='main.html'">← 커뮤니티 홈</button>
    </nav>

    <main class="wrap">
        <div class="panel">
            <!-- 로그인 전 -->
            <div id="loginView">
                <h1>🛰️ <strong>관제실</strong></h1>
                <p class="sub">운영자만 들어오는 곳이에요. 로그인하면 광장의 모든 궤적과 답을 지울 수 있습니다.</p>
                <form id="loginForm" autocomplete="on">
                    <div class="field">
                        <label for="email">이메일</label>
                        <input type="email" id="email" name="email" autocomplete="username" required>
                    </div>
                    <div class="field">
                        <label for="pw">비밀번호</label>
                        <input type="password" id="pw" name="current-password" autocomplete="current-password" required>
                    </div>
                    <button class="btn-main" id="btnLogin" type="submit">로그인</button>
                </form>
            </div>

            <!-- 로그인 후 -->
            <div id="doneView" style="display:none;">
                <h1>🛰️ <strong>관제실</strong></h1>
                <p class="sub">관리자로 로그인되어 있습니다.</p>
                <div class="who">
                    <span class="dot"></span>
                    <span class="txt">
                        <span class="t1" id="whoRole">—</span>
                        <span class="t2" id="whoMail"></span>
                    </span>
                </div>
                <a class="btn-line" href="lounge.html">광장으로 가기 →</a>
                <button class="btn-line" id="btnOut" type="button">로그아웃</button>
            </div>

            <div class="note" id="note"></div>
        </div>

        <!-- 신고함 — 로그인한 관리자에게만 보인다 -->
        <section class="log-panel" id="reportPanel" style="display:none;">
            <div class="rq-head">
                <h2>🚩 신고함</h2>
                <span class="rq-count" id="rqCount">–</span>
            </div>
            <div id="rqList"></div>
        </section>

        <!-- 업데이트 기록 — 로그인한 관리자에게만 보인다 -->
        <section class="log-panel" id="logPanel" style="display:none;">
            <h2>📡 Update Notes</h2>
            <div class="update-card">
                <div class="timeline">
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version">v1.5 — LATEST</div>
                            <div class="tl-date">2026. 08. 02</div>
                            <div class="tl-title">🔭 밤하늘 관측 커뮤니티로 방향 전환</div>
                            <div class="tl-desc">Lucky Orbit(복권 추첨기)과 오늘의 운세를 내렸어요 — 지우지 않고 <code>_archive/</code>에 보관해 두었습니다. 홈 패널을 없애고 <a href="sky.html" style="color:var(--accent);">밤하늘 달력</a>을 첫 화면으로 올렸고, 광장 채널을 관측 후기 · 장비 · 실시간 하늘 · 질문으로 갈아끼웠어요. 닉네임은 이제 상단 칩을 눌러 정합니다. 프로필 페이지는 레벨·스탯이 전부 정적 값이라 함께 내렸습니다.</div>
                            <div class="tl-tags"><span class="tl-tag">방향 전환</span><span class="tl-tag">궤도</span><span class="tl-tag gray">보관</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v1.4</div>
                            <div class="tl-date">2026. 07. 29</div>
                            <div class="tl-title">🚩 신고 기능</div>
                            <div class="tl-desc">이제 <a href="lounge.html" style="color:var(--accent);">광장</a>의 궤적과 답에 신고 버튼이 생겼어요. 사유를 고르고 보내면 관제실 신고함으로 접수됩니다. 누가 신고했는지는 공개되지 않고, 같은 대상에 여러 신고가 들어오면 한 번에 처리돼요.</div>
                            <div class="tl-tags"><span class="tl-tag">신고</span><span class="tl-tag gray">관제실</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v1.3</div>
                            <div class="tl-date">2026. 07. 29</div>
                            <div class="tl-title">🐾 반려동물 궤도 & 운세 점수제</div>
                            <div class="tl-desc">광장에 <a href="lounge.html" style="color:var(--accent);">반려동물 궤도</a>가 열렸어요 — 강아지·고양이·물고기까지 우리 집 식구를 자랑하는 곳이에요. 오늘의 운세는 애정·금전·직장운마다 점수와 등급이 붙어 한눈에 들어오고, 총운은 세 항목의 평균으로 계산돼요. 이 업데이트 기록은 관제실로 옮겼습니다.</div>
                            <div class="tl-tags"><span class="tl-tag">궤도</span><span class="tl-tag">운세</span><span class="tl-tag gray">관제실</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v1.2</div>
                            <div class="tl-date">2026. 07. 29</div>
                            <div class="tl-title">💬 궤적에 답을 달 수 있어요</div>
                            <div class="tl-desc">이제 <a href="lounge.html" style="color:var(--accent);">광장</a>의 각 궤적에 답을 남길 수 있어요. 글 아래 💬 버튼을 누르면 답이 펼쳐집니다. 내가 남긴 답은 언제든 지울 수 있고, 리액션만으로는 하기 어려웠던 이야기를 이어갈 수 있어요.</div>
                            <div class="tl-tags"><span class="tl-tag">댓글</span><span class="tl-tag">광장</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v1.1</div>
                            <div class="tl-date">2026. 07. 29</div>
                            <div class="tl-title">💪 운동 궤도 개편 & 광장 새로고침</div>
                            <div class="tl-desc">'새벽운동 궤도'가 <a href="lounge.html" style="color:var(--accent);">운동 궤도</a>로 넓어졌어요 — 러닝·헬스·홈트 전부 환영이에요. 채널마다 새로고침 버튼이 생겨서, 보던 궤적을 잃지 않고 새 글만 불러옵니다. '나' 표시는 닉네임이 아니라 기기 기준으로 바뀌어 같은 닉을 쓰는 다른 사람 글이 내 글로 보이지 않아요.</div>
                            <div class="tl-tags"><span class="tl-tag">광장</span><span class="tl-tag">새로고침</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v1.0</div>
                            <div class="tl-date">2026. 07. 28</div>
                            <div class="tl-title">🌠 오늘의 운세 오픈</div>
                            <div class="tl-desc">별자리·띠 운세가 fortune.html에 생겼어요. 총운 점수, 애정·금전·직장운, 행운의 숫자와 색까지 — 매일 자정 새 운세가 궤도에 올라옵니다.</div>
                            <div class="tl-tags"><span class="tl-tag">운세</span><span class="tl-tag">검색 유입</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v0.9</div>
                            <div class="tl-date">2026. 07. 28</div>
                            <div class="tl-title">⭐ 공통 푸터 & 이용약관·개인정보처리방침</div>
                            <div class="tl-desc">모든 페이지 하단에 반짝이는 별 서명이 담긴 푸터가 생겼어요. <a href="terms.html" style="color:var(--accent);">이용약관</a>과 <a href="privacy.html" style="color:var(--accent);">개인정보처리방침</a> 문서도 정식으로 마련됐어요.</div>
                            <div class="tl-tags"><span class="tl-tag">푸터</span><span class="tl-tag">약관</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v0.8</div>
                            <div class="tl-date">2026. 07. 28</div>
                            <div class="tl-title">🎰 Lucky Orbit 독립 페이지로 분리</div>
                            <div class="tl-desc">복권 추첨기가 lucky.html 주소를 갖게 됐어요. 사용법·FAQ가 붙었고, 검색으로도 찾아올 수 있어요. 여기 탭에서는 그대로 쓸 수 있어요.</div>
                            <div class="tl-tags"><span class="tl-tag">Lucky Orbit</span><span class="tl-tag">검색 유입</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v0.7</div>
                            <div class="tl-date">2026. 06. 13</div>
                            <div class="tl-title">🎣 오늘의 떡밥 & 광장 채널 개편</div>
                            <div class="tl-desc">매일 바뀌는 이야깃거리 '오늘의 떡밥' 탭 추가 — 누르면 광장 글쓰기로 바로 이어져요. 광장 궤도엔 채널 헤더가 생겼어요.</div>
                            <div class="tl-tags"><span class="tl-tag">떡밥</span><span class="tl-tag">채널</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v0.6</div>
                            <div class="tl-date">2026. 06. 13</div>
                            <div class="tl-title">🦦 수달 마스코트 & 대시보드 개편</div>
                            <div class="tl-desc">메인을 사이드바 + 패널 구조로 개편, 수달 마스코트 등장, 글 삭제 기능 추가.</div>
                            <div class="tl-tags"><span class="tl-tag">레이아웃</span><span class="tl-tag">마스코트</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v0.5</div>
                            <div class="tl-date">2026. 06. 12</div>
                            <div class="tl-title">🧡 컬러 리뉴얼 & 광장 베타</div>
                            <div class="tl-desc">주황 테마 전환, 광장 오픈, 이모지 교차 리액션, 파티클 이펙트 개선.</div>
                            <div class="tl-tags"><span class="tl-tag">리브랜딩</span><span class="tl-tag">광장</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v0.4</div>
                            <div class="tl-date">2026. 05. 25</div>
                            <div class="tl-title">🧑‍🚀 궤도 진입 시스템 추가</div>
                            <div class="tl-desc">닉네임 등록 후 나만의 프로필 카드로 궤도에 진입할 수 있어요.</div>
                            <div class="tl-tags"><span class="tl-tag">프로필</span><span class="tl-tag">진입 시스템</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v0.3</div>
                            <div class="tl-date">2026. 05. 22</div>
                            <div class="tl-title">🎰 Lucky Orbit 미니게임 추가</div>
                            <div class="tl-desc">카오스 알고리즘 기반 연금복권 / 로또 번호 생성기가 추가됐어요.</div>
                            <div class="tl-tags"><span class="tl-tag">미니게임</span><span class="tl-tag">연금복권</span><span class="tl-tag">로또</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v0.2</div>
                            <div class="tl-date">2026. 05. 21</div>
                            <div class="tl-title">커뮤니티 메인 페이지 오픈</div>
                            <div class="tl-desc">bento 그리드 레이아웃, 클릭 이펙트, 기본 카드 구성.</div>
                            <div class="tl-tags"><span class="tl-tag purple">UI</span><span class="tl-tag gray">레이아웃</span></div>
                        </div>
                    </div>
                    <div class="tl-item">
                        <div class="tl-left"><div class="tl-dot old"></div><div class="tl-line"></div></div>
                        <div class="tl-content">
                            <div class="tl-version old">v0.1</div>
                            <div class="tl-date">2026. 05. 01</div>
                            <div class="tl-title">Orbit 랜딩페이지 공개</div>
                            <div class="tl-desc">meteor shower 애니메이션, orbiting star 로고, 슬로건 적용.</div>
                            <div class="tl-tags"><span class="tl-tag gray">런칭</span><span class="tl-tag gray">랜딩</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script>
    (function(){
        var SB_URL = 'https://unwxpuvfqyjhgrcrmuhu.supabase.co';
        var SB_KEY = 'sb_publishable_KnyriHKUHNWw0QyIAXBmOA_0KaHPcXI'; // 공개용 키 (publishable)
        var sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;

        var note = document.getElementById('note');
        function say(msg, kind){
            note.textContent = msg || '';
            note.className = 'note' + (kind ? ' ' + kind : '');
        }

        if(!sb){
            say('로그인 모듈을 불러오지 못했어요. 새로고침 해주세요.', 'err');
            document.getElementById('btnLogin').disabled = true;
            return;
        }

        // 로그인은 됐는데 admins에 없는 계정일 수 있다.
        // 그 경우 "로그인 성공"만 보여주면 왜 삭제 버튼이 없는지 알 수 없으므로 구분해서 알린다.
        // 업데이트 기록은 관리자로 확인된 뒤에만 펼친다.
        // (숨김이 접근 제어는 아니지만, 관제실 콘텐츠를 로그인 전에 보일 이유가 없다)
        function showLog(on){
            document.getElementById('logPanel').style.display = on ? '' : 'none';
            document.getElementById('reportPanel').style.display = on ? '' : 'none';
        }

        // ===== 신고함 =====
        var RQ_REASONS = { spam:'도배 · 광고', abuse:'욕설 · 비방', adult:'선정적 · 불쾌',
                           privacy:'개인정보 노출', etc:'기타' };

        function esc(s){
            return String(s == null ? '' : s)
                .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        }
        function ago(iso){
            var s = (Date.now() - new Date(iso).getTime()) / 1000;
            if(s < 60) return '방금';
            if(s < 3600) return Math.floor(s/60) + '분 전';
            if(s < 86400) return Math.floor(s/3600) + '시간 전';
            if(s < 86400*7) return Math.floor(s/86400) + '일 전';
            return new Date(iso).toLocaleDateString('ko-KR');
        }

        async function loadReports(){
            var list = document.getElementById('rqList');
            var count = document.getElementById('rqCount');
            var r = await sb.rpc('report_queue');
            if(r.error){
                count.textContent = '–';
                list.innerHTML = '<div class="rq-empty">신고함을 불러오지 못했어요 — ' + esc(r.error.message) +
                    '<br>migration_007_reports.sql이 아직 실행되지 않았을 수 있어요.</div>';
                return;
            }
            var rows = r.data || [];
            var open = rows.filter(function(x){ return !x.handled; });
            count.textContent = open.length ? open.length + '건 미처리' : '미처리 없음';
            count.className = 'rq-count' + (open.length ? '' : ' zero');

            if(!rows.length){
                list.innerHTML = '<div class="rq-empty">아직 접수된 신고가 없어요.</div>';
                return;
            }
            list.innerHTML = '<div class="rq-list">' + rows.map(function(x){
                return '<div class="rq-item' + (x.handled ? ' handled' : '') + '" data-id="' + esc(x.id) + '">' +
                    '<div class="rq-top">' +
                    '<span class="rq-reason">' + esc(RQ_REASONS[x.reason] || x.reason) + '</span>' +
                    '<span class="rq-kind">' + (x.target_type === 'post' ? '궤적' : '답') +
                    (x.orbit ? ' · ' + esc(x.orbit) : '') + '</span>' +
                    (Number(x.dup_count) > 1 ? '<span class="rq-dup">신고 ' + x.dup_count + '건</span>' : '') +
                    '<span class="rq-when">' + ago(x.created_at) + '</span>' +
                    '</div>' +
                    (x.target_exists
                        ? '<div class="rq-nick">' + esc(x.nick) + '</div>' +
                          '<div class="rq-body">' + esc(x.content) + '</div>'
                        : '<div class="rq-gone">— 이미 삭제된 대상이에요</div>') +
                    (x.detail ? '<div class="rq-detail">' + esc(x.detail) + '</div>' : '') +
                    (x.handled ? '' :
                        '<div class="rq-acts">' +
                        (x.target_exists ? '<button class="rq-del" type="button" data-act="del">삭제하고 처리</button>' : '') +
                        '<button class="rq-ok" type="button" data-act="ok">문제 없음 · 처리</button>' +
                        '</div>') +
                    '</div>';
            }).join('') + '</div>';
        }

        // 목록이 매번 다시 그려지므로 위임으로 받는다
        document.getElementById('rqList').addEventListener('click', async function(e){
            var b = e.target.closest('button[data-act]');
            if(!b || b.disabled) return;
            var item = b.closest('.rq-item');
            var del = b.getAttribute('data-act') === 'del';
            if(del && !confirm('이 내용을 삭제하고 신고를 처리할까요? 되돌릴 수 없어요.')) return;

            item.querySelectorAll('button').forEach(function(x){ x.disabled = true; });
            b.textContent = '처리 중...';
            var res = await sb.rpc('resolve_report', {
                p_report_id: item.getAttribute('data-id'), p_delete_target: del
            });
            if(res.error){
                item.querySelectorAll('button').forEach(function(x){ x.disabled = false; });
                say('처리 실패 — ' + (res.error.message || ''), 'err');
                return;
            }
            loadReports();
        });

        async function showSession(session){
            if(!session){
                document.getElementById('loginView').style.display = '';
                document.getElementById('doneView').style.display = 'none';
                showLog(false);
                return;
            }
            showLog(false);   // 권한 확인 전까지는 닫아둔다
            document.getElementById('loginView').style.display = 'none';
            document.getElementById('doneView').style.display = '';
            document.getElementById('whoMail').textContent = session.user.email || session.user.id;

            var r = await sb.rpc('is_admin');
            if(r.error){
                document.getElementById('whoRole').textContent = '권한 확인 실패';
                say('관리자 여부를 확인하지 못했어요 — ' + (r.error.message || '') +
                    '\n마이그레이션(migration_005_admin.sql)이 아직 실행되지 않았을 수 있어요.', 'err');
                return;
            }
            if(r.data === true){
                document.getElementById('whoRole').textContent = '관리자';
                showLog(true);
                loadReports();
                say('광장에서 모든 궤적과 답에 삭제 버튼이 보입니다.', 'ok');
            } else {
                document.getElementById('whoRole').textContent = '일반 계정 (권한 없음)';
                say('로그인은 됐지만 이 계정은 관리자로 등록되어 있지 않아요.\n' +
                    'admins 테이블에 이 계정의 UID를 넣어야 합니다.\n\nUID: ' + session.user.id, 'err');
            }
        }

        document.getElementById('loginForm').addEventListener('submit', async function(e){
            e.preventDefault();
            var btn = document.getElementById('btnLogin');
            if(btn.dataset.busy) return;
            btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = '확인 중...';
            say('');

            var res = await sb.auth.signInWithPassword({
                email: document.getElementById('email').value.trim(),
                password: document.getElementById('pw').value
            });

            delete btn.dataset.busy; btn.disabled = false; btn.textContent = '로그인';
            if(res.error){
                var m = res.error.message || '';
                // 원인별로 다음에 뭘 해야 하는지 알려준다
                if(/Email not confirmed/i.test(m))
                    say('이메일 인증이 안 된 계정이에요. 대시보드에서 계정을 만들 때 ' +
                        "'Auto Confirm User'를 켜야 합니다.", 'err');
                else if(/Invalid login credentials/i.test(m))
                    say('이메일이나 비밀번호가 맞지 않아요.', 'err');
                else
                    say('로그인 실패 — ' + m, 'err');
                return;
            }
            document.getElementById('pw').value = '';
            showSession(res.data.session);
        });

        document.getElementById('btnOut').addEventListener('click', async function(){
            await sb.auth.signOut();
            say('로그아웃했습니다.');
            showSession(null);
        });

        sb.auth.getSession().then(function(r){ showSession(r.data.session); });
    })();
    </script>
</body>
</html>
````


## `terms.html`

> 155줄 · 9241바이트

이용약관 전문. 제6조가 밤하늘 달력 정보의 정확성 면책(방향 전환 때 Lucky Orbit 면책에서 교체됨).

````html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>이용약관 | Orbit</title>
    <meta name="description" content="Orbit(orbithere.com) 커뮤니티 서비스의 이용약관입니다.">
    <meta name="theme-color" content="#0F172A">
    <link rel="canonical" href="https://orbithere.com/terms.html">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Orbit">
    <meta property="og:title" content="이용약관 | Orbit">
    <meta property="og:description" content="Orbit(orbithere.com) 커뮤니티 서비스의 이용약관입니다.">
    <meta property="og:url" content="https://orbithere.com/terms.html">
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
    <link rel="stylesheet" href="/orbit.css">
    <style>
        .container { max-width: 720px; margin: 130px auto 0; padding: 0 20px; }

        .hero { margin-bottom: 30px; }
        .hero h1 { font-size: 1.8rem; font-weight: 200; margin: 0; line-height: 1.3; }
        .hero h1 strong { color: var(--accent); font-weight: 700; }
        .hero p { color: #94A3B8; margin-top: 10px; font-size: 0.9rem; line-height: 1.7; }
        .effective { font-size: 12px; color: #64748B; margin-top: 6px; }

        .doc h2 {
            font-size: 1.05rem; font-weight: 600; margin: 34px 0 12px;
            padding-bottom: 8px; border-bottom: 1px solid rgba(255,159,67,0.12);
        }
        .doc p { color: #94A3B8; font-size: 14px; line-height: 1.8; margin: 0 0 12px; }
        .doc ul, .doc ol { color: #94A3B8; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 12px; }
        .doc li { margin-bottom: 6px; }
        .doc strong { color: var(--accent); font-weight: 600; }
        .doc a { color: var(--accent); }

        .notice {
            margin-top: 28px; padding: 16px 18px;
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px; font-size: 12.5px; color: #64748B; line-height: 1.7;
        }

        @media (max-width: 768px) {
            .hero h1 { font-size: 1.45rem; }
            .container { margin-top: 110px; }
        }

        ::selection { background-color: #4FD1C5; color: #0F172A; }

        /* ===== 공통 푸터 ===== */
    </style>
</head>
<body>
    <div class="bg-glow"></div>

    <nav class="site-topbar">
        <a class="logo" href="index.html">ORBIT.</a>
        <button class="nav-back" onclick="location.href='main.html'">← 커뮤니티 홈</button>
    </nav>

    <main class="container">
        <div class="hero">
            <h1>Orbit <strong>이용약관</strong></h1>
            <p>궤도에 오래 머물 수 있도록, 서로 지키면 좋은 것들을 적어둔 페이지예요.</p>
            <div class="effective">시행일: 2026년 8월 2일 <span style="color:#64748B;">(직전 시행일: 2026년 7월 28일)</span></div>
        </div>

        <div class="doc">
            <h2>제1조 (목적)</h2>
            <p>이 약관은 Orbit(orbithere.com, 이하 "서비스")이 제공하는 커뮤니티 및 부가 기능의 이용 조건과 절차, 이용자와 운영자의 권리·의무를 정하는 것을 목적으로 합니다.</p>

            <h2>제2조 (서비스의 성격)</h2>
            <ul>
                <li>서비스는 <strong>무료</strong>로 제공되며, 별도의 회원가입·로그인 절차 없이 이용할 수 있습니다.</li>
                <li>서비스는 현재 <strong>베타</strong> 단계로, 기능이 예고 없이 추가·변경·중단될 수 있습니다.</li>
                <li>서비스는 개인이 운영하는 프로젝트로, 상시적인 고객 지원을 보장하지 않습니다.</li>
            </ul>

            <h2>제3조 (닉네임과 게시물)</h2>
            <ul>
                <li>닉네임은 브라우저에 저장되는 간이 식별 수단으로, 베타 기간 동안 <strong>중복이 발생할 수 있으며</strong> 소유권이 보장되지 않습니다.</li>
                <li>이용자가 작성한 게시물(궤적)의 책임은 작성자 본인에게 있습니다.</li>
                <li>게시물은 모두에게 공개되는 공간에 저장되므로, 개인정보(연락처·주소 등)를 게시물에 적지 않도록 주의해 주세요.</li>
            </ul>

            <h2>제4조 (금지 행위)</h2>
            <p>다음 행위는 금지되며, 해당 게시물은 사전 통보 없이 삭제될 수 있습니다.</p>
            <ul>
                <li>타인에 대한 비방, 모욕, 혐오 표현, 차별적 발언</li>
                <li>음란물, 불법 정보, 사행성 도박 권유 등 법령에 위반되는 콘텐츠 게시</li>
                <li>타인 사칭, 개인정보 무단 게시</li>
                <li>도배, 광고, 스팸 등 서비스의 정상적인 운영을 방해하는 행위</li>
                <li>서비스의 데이터베이스·시스템에 대한 비정상적인 접근 시도</li>
            </ul>

            <h2>제5조 (게시물의 관리)</h2>
            <ul>
                <li>운영자는 제4조를 위반하거나 서비스 취지에 맞지 않는 게시물을 삭제할 수 있습니다.</li>
                <li>이용자는 본인이 작성한 게시물을 직접 삭제할 수 있습니다.</li>
            </ul>

            <h2>제6조 (밤하늘 달력 등 부가 기능에 대한 안내)</h2>
            <ul>
                <li>밤하늘 달력이 제공하는 천문 현상 일정과 달 위상은 <strong>참고용 정보</strong>입니다. 공개 자료와 자체 계산에 기반하며, 실제 관측 결과를 보장하지 않습니다.</li>
                <li>관측 계획, 이동, 장비 구매 등 이용자의 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.</li>
                <li>야간·야외 관측에는 안전 위험이 따를 수 있습니다. 이동과 관측 과정에서 발생한 사고에 대해 서비스는 책임지지 않습니다.</li>
            </ul>

            <h2>제7조 (책임의 한계)</h2>
            <ul>
                <li>서비스는 "있는 그대로(as-is)" 제공되며, 무중단·무오류를 보장하지 않습니다.</li>
                <li>운영자는 천재지변, 인프라 장애 등 불가항력으로 인한 서비스 중단, 또는 이용자 간 분쟁·게시물로 인해 발생한 손해에 대해 책임을 지지 않습니다.</li>
                <li>베타 기간 중 데이터(게시물, 닉네임 등)는 서비스 개편 과정에서 초기화될 수 있습니다.</li>
            </ul>

            <h2>제8조 (저작권)</h2>
            <ul>
                <li>이용자가 작성한 게시물의 저작권은 작성자에게 있습니다. 다만 서비스는 게시물을 서비스 화면에 표시하기 위한 범위에서 이를 사용할 수 있습니다.</li>
                <li>서비스의 디자인, 로고, 캐릭터 등은 무단으로 상업적 이용할 수 없습니다.</li>
            </ul>

            <h2>제9조 (약관의 변경)</h2>
            <p>이 약관은 필요 시 변경될 수 있으며, 변경 시 이 페이지에 시행일과 함께 게시합니다. 변경 이후에도 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다.</p>

            <h2>제10조 (문의)</h2>
            <p>서비스에 관한 문의는 <a href="lounge.html">글 남기기</a>를 통해 남겨주세요.</p>

            <div class="notice">
                이 약관에서 정하지 않은 사항은 관련 법령 및 일반적인 관례에 따릅니다. · 관련 문서: <a href="privacy.html" style="color:#94A3B8;">개인정보처리방침</a>
            </div>
        </div>
    </main>

    <footer class="site-footer">
        <div class="foot-links">
            <a href="main.html">커뮤니티 홈</a>
            <a href="sky.html">밤하늘 달력</a>
            <a href="lounge.html">글 남기기</a>
            <a href="terms.html">이용약관</a>
            <a href="privacy.html">개인정보처리방침</a>
        </div>
        <div class="foot-sign">
            © 2026 Orbit · Made with
            <svg class="foot-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M 50 15 L 62 34 L 83 39 L 69 56 L 71 78 L 50 70 L 29 78 L 31 56 L 17 39 L 38 34 Z" fill="#FF9F43" stroke="#FF9F43" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/></svg>
            in orbit
        </div>
    </footer>
</body>
</html>
````


## `privacy.html`

> 177줄 · 11961바이트

개인정보처리방침 전문. 기기 식별자(author_device / device_id / reporter_device) 수집을 수집 표·이용 목적·보관 파기·localStorage 목록에 명시한다.

````html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>개인정보처리방침 | Orbit</title>
    <meta name="description" content="Orbit(orbithere.com)이 어떤 정보를 어떻게 다루는지 설명하는 개인정보처리방침입니다.">
    <meta name="theme-color" content="#0F172A">
    <link rel="canonical" href="https://orbithere.com/privacy.html">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Orbit">
    <meta property="og:title" content="개인정보처리방침 | Orbit">
    <meta property="og:description" content="Orbit(orbithere.com)이 어떤 정보를 어떻게 다루는지 설명하는 개인정보처리방침입니다.">
    <meta property="og:url" content="https://orbithere.com/privacy.html">
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
    <link rel="stylesheet" href="/orbit.css">
    <style>
        .container { max-width: 720px; margin: 130px auto 0; padding: 0 20px; }

        .hero { margin-bottom: 30px; }
        .hero h1 { font-size: 1.8rem; font-weight: 200; margin: 0; line-height: 1.3; }
        .hero h1 strong { color: var(--accent); font-weight: 700; }
        .hero p { color: #94A3B8; margin-top: 10px; font-size: 0.9rem; line-height: 1.7; }
        .effective { font-size: 12px; color: #64748B; margin-top: 6px; }

        .doc h2 {
            font-size: 1.05rem; font-weight: 600; margin: 34px 0 12px;
            padding-bottom: 8px; border-bottom: 1px solid rgba(255,159,67,0.12);
        }
        .doc p { color: #94A3B8; font-size: 14px; line-height: 1.8; margin: 0 0 12px; }
        .doc ul, .doc ol { color: #94A3B8; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 12px; }
        .doc li { margin-bottom: 6px; }
        .doc strong { color: var(--accent); font-weight: 600; }
        .doc a { color: var(--accent); }
        .doc code {
            font-family: inherit; font-size: 13px;
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.07);
            border-radius: 6px; padding: 1px 6px; color: #CBD5E1;
        }
        .doc table {
            width: 100%; border-collapse: collapse; font-size: 13px; color: #94A3B8;
            margin: 0 0 12px;
        }
        .doc th, .doc td {
            text-align: left; padding: 8px 10px;
            border-bottom: 1px solid rgba(255,255,255,0.06); line-height: 1.6;
        }
        .doc th { color: #CBD5E1; font-weight: 600; font-size: 12px; }

        .notice {
            margin-top: 28px; padding: 16px 18px;
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px; font-size: 12.5px; color: #64748B; line-height: 1.7;
        }

        @media (max-width: 768px) {
            .hero h1 { font-size: 1.45rem; }
            .container { margin-top: 110px; }
        }

        ::selection { background-color: #4FD1C5; color: #0F172A; }

        /* ===== 공통 푸터 ===== */
    </style>
</head>
<body>
    <div class="bg-glow"></div>

    <nav class="site-topbar">
        <a class="logo" href="index.html">ORBIT.</a>
        <button class="nav-back" onclick="location.href='main.html'">← 커뮤니티 홈</button>
    </nav>

    <main class="container">
        <div class="hero">
            <h1>Orbit <strong>개인정보처리방침</strong></h1>
            <p>Orbit은 회원가입 없이 쓰는 서비스라 모으는 정보 자체가 아주 적어요. 그래도 무엇을, 왜, 어떻게 다루는지 투명하게 적어둡니다.</p>
            <div class="effective">시행일: 2026년 8월 2일 <span style="color:#64748B;">(직전 시행일: 2026년 7월 28일)</span></div>
        </div>

        <div class="doc">
            <h2>1. 수집하는 정보</h2>
            <p>Orbit(orbithere.com, 이하 "서비스")은 회원가입·로그인 절차가 없으며, 다음 정보만을 다룹니다.</p>
            <table>
                <tr><th>항목</th><th>내용</th><th>저장 위치</th></tr>
                <tr><td>닉네임</td><td>이용자가 직접 입력한 별칭</td><td>이용자 브라우저(localStorage), 글 작성 시 데이터베이스</td></tr>
                <tr><td>게시물</td><td>작성한 글·답(댓글)·리액션과 작성 시각</td><td>데이터베이스(Supabase)</td></tr>
                <tr><td><strong>기기 식별자</strong></td><td>브라우저가 처음 접속할 때 무작위로 만들어 저장하는 값(UUID). 실명·계정과 연결되지 않으며, 어느 기기에서 쓴 글인지만 구분합니다.</td><td>이용자 브라우저(localStorage), 글·답·리액션·신고 작성 시 데이터베이스</td></tr>
            </table>
            <p>기기 식별자는 로그인 없이 아래 세 가지를 하기 위해 필요합니다.</p>
            <ul>
                <li><strong>내 글을 나만 지울 수 있게</strong> — 작성한 기기가 일치할 때만 삭제됩니다(<code>author_device</code>)</li>
                <li><strong>리액션을 한 번만 세도록</strong> — 같은 기기가 같은 글에 같은 이모지를 중복으로 누르지 못하게 합니다(<code>device_id</code>)</li>
                <li><strong>도배와 중복 신고를 막도록</strong> — 일정 시간 안의 작성 횟수를 제한하고, 같은 대상에 대한 반복 신고를 한 건으로 처리합니다(<code>reporter_device</code>)</li>
            </ul>
            <p>이 값은 <strong>다른 이용자에게 공개되지 않습니다.</strong> 리액션 정보는 개수와 "내가 눌렀는지" 여부만 계산해서 내려주고, 신고 내역은 운영자만 열람할 수 있습니다.</p>
            <ul>
                <li>이름, 이메일, 전화번호, 위치정보 등 <strong>실명 기반 개인정보는 수집하지 않습니다.</strong></li>
                <li>서비스 자체적으로 별도의 방문자 추적(analytics) 도구를 사용하지 않습니다.</li>
                <li>호스팅(GitHub Pages)·데이터베이스(Supabase) 사업자가 서비스 운영을 위해 접속 기록(IP 주소 등)을 자동 수집할 수 있으며, 이는 각 사업자의 개인정보처리방침을 따릅니다.</li>
            </ul>

            <h2>2. 이용 목적</h2>
            <ul>
                <li>닉네임: 커뮤니티 내 작성자 표시</li>
                <li>게시물: 커뮤니티 서비스 제공(모든 이용자에게 공개 표시)</li>
                <li>기기 식별자: 본인 게시물 삭제 권한 확인, 리액션 중복 방지, 도배·중복 신고 방지</li>
            </ul>

            <h2>3. 보관 및 파기</h2>
            <ul>
                <li>닉네임과 기기 식별자(localStorage)는 이용자가 브라우저 데이터를 지우면 즉시 삭제됩니다. 이 경우 그 전에 쓴 글에 대한 삭제 권한도 함께 사라집니다.</li>
                <li>게시물에 함께 저장된 기기 식별자는 해당 게시물이 삭제될 때 같이 삭제됩니다.</li>
                <li>게시물은 이용자가 직접 삭제하거나 운영자가 운영 정책에 따라 삭제할 때까지 보관됩니다.</li>
                <li>베타 기간 중 서비스 개편으로 데이터가 일괄 초기화될 수 있습니다.</li>
            </ul>

            <h2>4. 브라우저 저장소(localStorage) 사용</h2>
            <p>서비스는 로그인 대신 브라우저 저장소에 아래 값을 저장합니다. 모두 이용자 기기에만 저장되며, 브라우저 설정에서 언제든 삭제할 수 있습니다.</p>
            <ul>
                <li><code>orbit_nickname</code> — 닉네임</li>
                <li><code>orbit_joindate</code>, <code>orbit_jointime</code> — 궤도 진입 시점</li>
                <li><code>orbit_device_id</code> — 기기 식별자(무작위 UUID). 위 1항의 용도로 쓰입니다</li>
            </ul>
            <p>지난 버전에서 쓰던 <code>orbit_zodiac</code>, <code>orbit_animal</code>(운세 페이지에서 고른 별자리·띠)이 브라우저에 남아 있을 수 있습니다. 해당 기능을 내리면서 더 이상 저장하거나 읽지 않으며, 브라우저 데이터를 지우면 함께 삭제됩니다.</p>

            <h2>5. 제3자 제공 및 처리 위탁</h2>
            <p>수집한 정보를 제3자에게 판매하거나 제공하지 않습니다. 다만 서비스 운영을 위해 아래 인프라를 이용합니다.</p>
            <table>
                <tr><th>사업자</th><th>용도</th></tr>
                <tr><td>GitHub Pages</td><td>웹사이트 호스팅</td></tr>
                <tr><td>Supabase</td><td>게시물 데이터베이스</td></tr>
                <tr><td>jsDelivr CDN</td><td>웹폰트·라이브러리 전송</td></tr>
            </table>

            <h2>6. 광고에 관한 안내</h2>
            <p>향후 서비스에 광고(Google AdSense 등 제3자 광고 서비스)가 게재될 수 있습니다. 이 경우 광고 사업자는 맞춤 광고 제공을 위해 쿠키를 사용할 수 있으며, 이용자는 <a href="https://adssettings.google.com" rel="noopener" target="_blank">Google 광고 설정</a>에서 맞춤 광고를 관리하거나 거부할 수 있습니다. 광고 도입 시 이 방침을 갱신해 고지합니다.</p>

            <h2>7. 이용자의 권리</h2>
            <ul>
                <li>이용자는 본인이 작성한 게시물을 언제든 직접 삭제할 수 있습니다.</li>
                <li>브라우저 데이터를 삭제하면 닉네임과 기기 식별자가 함께 사라집니다. 다만 이미 올린 게시물은 그대로 남으며, 삭제 권한이 사라지므로 지우고 싶은 글은 미리 삭제하시거나 아래 경로로 요청해 주세요.</li>
                <li>기타 삭제 요청이나 문의는 <a href="lounge.html">글 남기기</a>를 통해 남겨주세요.</li>
            </ul>

            <h2>8. 방침의 변경</h2>
            <p>이 방침은 법령이나 서비스 변경에 따라 개정될 수 있으며, 개정 시 이 페이지에 시행일과 함께 게시합니다.</p>

            <div class="notice">
                게시물은 공개 공간에 저장돼요. 연락처·주소 같은 개인정보는 글에 적지 않는 것을 권장합니다. · 관련 문서: <a href="terms.html" style="color:#94A3B8;">이용약관</a>
            </div>
        </div>
    </main>

    <footer class="site-footer">
        <div class="foot-links">
            <a href="main.html">커뮤니티 홈</a>
            <a href="sky.html">밤하늘 달력</a>
            <a href="lounge.html">글 남기기</a>
            <a href="terms.html">이용약관</a>
            <a href="privacy.html">개인정보처리방침</a>
        </div>
        <div class="foot-sign">
            © 2026 Orbit · Made with
            <svg class="foot-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M 50 15 L 62 34 L 83 39 L 69 56 L 71 78 L 50 70 L 29 78 L 31 56 L 17 39 L 38 34 Z" fill="#FF9F43" stroke="#FF9F43" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/></svg>
            in orbit
        </div>
    </footer>
</body>
</html>
````


## `404.html`

> 88줄 · 3680바이트

커스텀 404.

````html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 | Orbit</title>
    <meta name="description" content="이 궤도에는 아무것도 없어요 — 페이지를 찾을 수 없습니다.">
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#0F172A">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css" />
    <link rel="stylesheet" href="/orbit.css">
    <style>
        body {
            min-height: 100vh;
            display: flex; flex-direction: column;
            justify-content: center; align-items: center;
            text-align: center; padding: 20px;
            touch-action: manipulation;
        }

        /* 길 잃은 별 — 궤도를 벗어나 떠다닌다 */
        .lost-star {
            width: 56px; height: 56px; margin-bottom: 26px;
            animation: drift 5s ease-in-out infinite;
        }
        @keyframes drift {
            0%, 100% { transform: translate(0, 0) rotate(-8deg); }
            50%      { transform: translate(10px, -14px) rotate(10deg); }
        }

        .code {
            font-size: 0.8rem; letter-spacing: 0.3em;
            color: var(--accent); opacity: 0.6; font-weight: 300;
            margin: 0 0 10px;
        }
        h1 {
            font-size: 1.5rem; font-weight: 200; letter-spacing: -0.02em;
            color: var(--text-main); margin: 0;
        }
        h1 strong { color: var(--accent); font-weight: 600; }
        .sub {
            font-size: 0.85rem; color: #94A3B8;
            margin-top: 12px; line-height: 1.7;
        }

        .links { display: flex; gap: 10px; margin-top: 30px; flex-wrap: wrap; justify-content: center; }
        .links a {
            font-size: 13px; font-weight: 600; text-decoration: none;
            padding: 10px 20px; border-radius: 12px; transition: 0.2s;
        }
        .links .go-main { background: var(--accent); color: #0F172A; }
        .links .go-main:hover { opacity: 0.88; }
        .links .go-home {
            color: #94A3B8; border: 1px solid rgba(255,255,255,0.1);
        }
        .links .go-home:hover { color: var(--accent); border-color: rgba(255,159,67,0.35); }

        @media (prefers-reduced-motion: reduce) {
            .lost-star { animation: none; }
        }

        ::selection { background-color: #4FD1C5; color: #0F172A; }
    </style>
    <script src="/effects.js" defer></script>
</head>
<body>
    <div class="bg-glow"></div>

    <svg class="lost-star" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M 50 15 L 62 34 L 83 39 L 69 56 L 71 78 L 50 70 L 29 78 L 31 56 L 17 39 L 38 34 Z"
              fill="#FF9F43" stroke="#FF9F43" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>

    <p class="code">404</p>
    <h1>이 궤도에는 <strong>아무것도</strong> 없어요</h1>
    <p class="sub">주소가 바뀌었거나, 별이 다른 궤도로 떠났나 봐요.<br>아래에서 돌아갈 궤도를 골라주세요.</p>

    <nav class="links">
        <a class="go-main" href="/main.html">커뮤니티 홈으로</a>
        <a class="go-home" href="/">대문으로</a>
    </nav>
</body>
</html>
````


## `orbit.css`

> 173줄 · 8121바이트

공통 스타일. 색 변수(:root) · 스크롤바 · 배경 글로우 · 상단바 · 푸터 · 콘텐츠 페이지 공통(hero/seo-content/notice/cta-lounge) · prefers-reduced-motion 전역 처리. 각 페이지 <style>이 이 파일보다 뒤에 오므로 페이지 쪽이 이긴다.

````css
/* ============================================================
   Orbit 공통 스타일
   ------------------------------------------------------------
   모든 페이지가 실제로 함께 쓰는 것만 둔다.
   색 변수 · 기본 body · 배경 글로우 · 상단바 · 푸터 · 모션 감속.

   각 페이지의 <style>은 이 파일보다 뒤에 오므로,
   페이지 고유 스타일은 그대로 두고 필요하면 여기 값을 덮어쓰면 된다.
   (예: main.html은 푸터를 사이드바 레이아웃에 맞춰 다시 잡는다)

   상단바를 태그 이름(`nav`)이 아니라 `.site-topbar`로 잡는 이유:
   main.html의 사이드바(<nav class="side-nav">)와
   index.html의 바로가기(<nav class="quick-links">)도 nav 요소라서
   태그로 잡으면 그 둘까지 상단 고정바가 되어 버린다.
   `.topbar`가 아닌 이유는 main.html이 그 이름을 앱 셸의 상단바로 이미 쓰고 있어서다.
   ============================================================ */

:root {
    --bg-color:  #0F172A;
    --accent:    #FF9F43;
    --text-main: #E2E8F0;
    --card-bg:   rgba(30, 41, 59, 0.7);
    --mint:      #4FD1C5;
}

* { box-sizing: border-box; }

body {
    margin: 0;
    background-color: var(--bg-color);
    color: var(--text-main);
    font-family: 'Pretendard', sans-serif;
    overflow-x: hidden;
}

/* ===== 스크롤바 =====
   기본 스크롤바는 밝은 회색이라 어두운 밤하늘 배경 위에서 혼자 튄다.
   표준 속성(scrollbar-*)과 WebKit 전용을 함께 둔다 — 표준 쪽은 Firefox와
   최신 크롬이, WebKit 쪽은 사파리와 옛 크롬이 읽는다.
   폭까지 줄이면 터치패드가 아닌 마우스 사용자가 잡기 어려워지므로 색만 맞춘다. */
* {
    scrollbar-width: thin;
    scrollbar-color: rgba(255,159,67,0.28) transparent;
}
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
    background: rgba(255,159,67,0.25);
    border-radius: 99px;
    /* 투명 테두리 + background-clip으로 트랙과 사이를 띄운다 */
    border: 2px solid transparent;
    background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background: rgba(255,159,67,0.45); background-clip: content-box; }
::-webkit-scrollbar-corner { background: transparent; }

/* ===== 배경 글로우 ===== */
.bg-glow {
    position: fixed; top: -10%; right: -10%;
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(255,159,67,0.08) 0%, rgba(15,23,42,0) 70%);
    pointer-events: none; z-index: -1;
}

/* ===== 상단바 ===== */
.site-topbar {
    position: fixed; top: 0; width: 100%;
    padding: 1.5rem 2rem;
    display: flex; justify-content: space-between; align-items: center;
    z-index: 100; backdrop-filter: blur(15px);
    border-bottom: 1px solid rgba(255,159,67,0.1);
}
.logo { font-weight: 700; letter-spacing: 2px; color: var(--accent); cursor: pointer; text-decoration: none; }
.nav-back {
    font-size: 12px; color: #64748B; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
    padding: 6px 12px; transition: 0.2s; background: transparent;
    font-family: 'Pretendard';
}
.nav-back:hover { color: var(--accent); border-color: rgba(255,159,67,0.3); }

/* ===== 푸터 ===== */
.site-footer {
    max-width: 720px; margin: 60px auto 0; padding: 26px 20px 36px;
    border-top: 1px solid rgba(255,159,67,0.1); text-align: center;
}
.foot-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px 18px; margin-bottom: 13px; }
.foot-links a { font-size: 12px; color: #64748B; text-decoration: none; transition: color 0.2s; }
.foot-links a:hover { color: var(--accent); }
.foot-sign {
    font-size: 11.5px; color: #64748B; letter-spacing: 0.03em;
    display: flex; align-items: center; justify-content: center; gap: 5px;
}
.foot-star { width: 13px; height: 13px; flex-shrink: 0; animation: foot-twinkle 2.8s ease-in-out infinite; }
@keyframes foot-twinkle {
    0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.85; }
    50%      { transform: scale(1.2) rotate(18deg); opacity: 1; }
}

/* ============================================================
   콘텐츠 페이지 공통 (lucky · fortune · sky가 함께 쓴다)
   ------------------------------------------------------------
   세 페이지에 똑같이 복붙되어 있던 히어로 · SEO 본문 · 안내 박스 ·
   광장 CTA를 한곳으로 모았다. 페이지 고유의 추가 규칙
   (lucky의 code/tiny-note, sky의 .notice a)은 각 페이지에 남긴다.
   ============================================================ */
.hero { margin-bottom: 26px; }
.hero h1 { font-size: 2rem; font-weight: 200; margin: 0; line-height: 1.3; }
.hero h1 strong { color: var(--accent); font-weight: 700; }
.hero p { color: #94A3B8; margin-top: 12px; font-size: 0.95rem; line-height: 1.7; }

.seo-content { margin-top: 44px; }
.seo-content h2 {
    font-size: 1.15rem; font-weight: 600; margin: 36px 0 12px;
    padding-bottom: 8px; border-bottom: 1px solid rgba(255,159,67,0.12);
}
.seo-content h3 { font-size: 0.95rem; font-weight: 600; margin: 20px 0 6px; color: #CBD5E1; }
.seo-content p { color: #94A3B8; font-size: 14px; line-height: 1.8; margin: 0 0 12px; }
.seo-content ol, .seo-content ul { color: #94A3B8; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 12px; }
.seo-content li { margin-bottom: 6px; }
.seo-content strong { color: var(--accent); font-weight: 600; }

.notice {
    margin-top: 28px; padding: 16px 18px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; font-size: 12.5px; color: #64748B; line-height: 1.7;
}

.cta-lounge {
    display: block; margin-top: 32px; padding: 20px 22px; text-decoration: none;
    background: linear-gradient(135deg, rgba(255,159,67,0.12), rgba(255,183,77,0.04));
    border: 1px solid rgba(255,159,67,0.25); border-radius: 16px;
    transition: 0.2s;
}
.cta-lounge:hover { border-color: rgba(255,159,67,0.5); transform: translateY(-2px); }
.cta-lounge .ct { font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 5px; }
.cta-lounge .cd { font-size: 12.5px; color: #94A3B8; line-height: 1.6; }

@media (max-width: 768px) {
    .hero h1 { font-size: 1.55rem; }
}

/* ============================================================
   모션 감속 (prefers-reduced-motion)
   ------------------------------------------------------------
   이 사이트는 유성우·파티클·반짝임이 계속 움직인다.
   전정기관이 예민하거나 멀미가 있는 분들에게는 그게 실제로 괴로우므로,
   기기에서 "동작 줄이기"를 켠 경우에는 움직임을 걷어낸다.

   애니메이션을 0으로 만들지 않고 0.01ms로 두는 이유:
   animation 완료(animationend)를 기다렸다 다음 일을 하는 코드가 있어도
   그 이벤트는 그대로 발생하기 때문에 화면이 멈춰버리지 않는다.
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }

    /* 끝난 자리에 흔적만 남는 장식들은 아예 감춘다.
       (유성우는 마지막 프레임이 opacity:0이라 어차피 보이지 않는다) */
    .starfield, .meteor { display: none !important; }

    /* 반짝이는 별은 움직임만 멈추고 그대로 보이게 둔다 */
    .foot-star { animation: none !important; opacity: 0.9 !important; }

    /* 대문의 "아무곳이나 클릭" 힌트는 기본 opacity가 0이고 애니메이션으로만
       나타난다. 애니메이션을 1회로 줄이면 힌트가 영영 안 보이므로,
       여기서는 애니메이션 없이 고정된 밝기로 보여준다. */
    .click-hint { animation: none !important; opacity: 0.5 !important; }
}
````


## `effects.js`

> 229줄 · 9844바이트

클릭하면 별이 튀는 canvas 파티클 엔진(rAF). visualViewport 기준으로 그려서 핀치 확대·키보드에도 잔상이 남지 않는다. 동작 줄이기 설정이면 아예 실행하지 않고, 입력창 탭과 확대 상태에서는 건너뛴다.

````js
/* Orbit 클릭 이펙트 — requestAnimationFrame 기반 파티클 엔진
   기존 CSS 키프레임 방식 대신 매 프레임 위치를 계산해
   중력/감속/회전/반짝임이 있는 물리감을 표현한다.

   모바일 주의점: 캔버스는 레이아웃 뷰포트가 아니라 "실제로 보이는 영역"
   (visualViewport)에 맞춘다. 핀치 확대나 키보드가 올라와 보이는 영역이
   바뀌어도 파티클이 배율만큼 커지거나 지워지지 않은 잔상이 남지 않는다. */
(function () {
    // 기기에서 "동작 줄이기"를 켠 사용자에게는 파티클을 띄우지 않는다.
    // CSS는 orbit.css의 prefers-reduced-motion 블록이 맡지만, 캔버스로 그리는
    // 이 이펙트는 CSS가 닿지 않으므로 여기서 직접 확인해야 한다.
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion && reduceMotion.matches) return;

    var ACCENT = '#FF9F43';   // 별 메인
    var LIGHT  = '#FFD08A';   // 별 라이트
    var MINT   = '#4FD1C5';   // 반짝이 포인트 (대문의 민트와 연결)

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9999;transform-origin:0 0;';
    var ctx = canvas.getContext('2d');
    // 화면 배율. 브라우저 확대/축소를 바꾸면 값이 달라지므로 resize마다 다시 읽는다.
    // (한 번만 읽어두면 축소한 채로 새로고침하지 않는 한 낡은 값이 계속 쓰인다)
    var dpr = 1;
    var vv = window.visualViewport || null;

    // 보이는 영역: 크기(w,h), 레이아웃 뷰포트 기준 오프셋(x,y), 확대 배율(s)
    var view = { w: 0, h: 0, x: 0, y: 0, s: 1 };

    function measure() {
        if (vv) {
            view.w = vv.width; view.h = vv.height;
            view.x = vv.offsetLeft; view.y = vv.offsetTop;
            view.s = vv.scale || 1;
        } else {
            view.w = window.innerWidth; view.h = window.innerHeight;
            view.x = 0; view.y = 0; view.s = 1;
        }
    }

    function place() {
        // 위치만 갱신 — 캔버스 크기를 건드리지 않아 진행 중인 파티클이 지워지지 않는다
        canvas.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px)';
    }

    // 캔버스를 통째로 비운다.
    //
    // clearRect는 "현재 변환"의 영향을 받는다. ctx에는 setTransform(dpr)이 걸려 있어서
    // clearRect(0, 0, canvas.width, canvas.height)를 그대로 부르면
    // 실제로 지워지는 범위가 canvas.width*dpr × canvas.height*dpr CSS픽셀이 된다.
    //
    // dpr이 1 이상이면 필요보다 넘치게 지워서 아무 문제가 없다. 그런데 브라우저를
    // 100% 미만으로 축소하면 devicePixelRatio가 1보다 작아지고, 지워지는 영역이
    // 화면의 dpr²까지 줄어든다. (85%면 약 70%) 그 바깥으로 날아간 파티클은
    // 매 프레임 덮어 그려지기만 하고 지워지지 않아 잔상으로 눌어붙는다.
    //
    // 그래서 변환을 걷어낸 좌표계에서 지운다 — 배율이 얼마든 캔버스 전체가 확실히 비워진다.
    function clearAll() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    function resize() {
        measure();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.style.width = view.w + 'px';
        canvas.style.height = view.h + 'px';
        canvas.width = Math.round(view.w * dpr);   // 대입 자체가 캔버스를 비운다
        canvas.height = Math.round(view.h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        place();
    }

    function onViewportScroll() { measure(); place(); }

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    if (vv) {
        vv.addEventListener('resize', resize);
        vv.addEventListener('scroll', onViewportScroll);
    }
    document.body.appendChild(canvas);
    resize();

    var parts = [];
    var running = false;
    var last = 0;

    function starPath(c, r) {
        c.beginPath();
        for (var i = 0; i < 5; i++) {
            var a = -Math.PI / 2 + i * 2 * Math.PI / 5;
            var b = a + Math.PI / 5;
            c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            c.lineTo(Math.cos(b) * r * 0.5, Math.sin(b) * r * 0.5);
        }
        c.closePath();
    }

    function burst(x, y) {
        // 젤리 별 — 위로 살짝 던져진 뒤 중력으로 떨어지며 회전
        // 개수는 한 번 줄였다(7~11 → 4~7). 연타하게 되는 버튼들이 있어서
        // 원래 값이면 화면이 별로 뒤덮였다. 터질 때의 인상은 개수보다
        // 흩어지는 속도와 반짝임이 만들기 때문에 줄여도 심심해지지 않는다.
        var n = 4 + Math.floor(Math.random() * 4);
        for (var i = 0; i < n; i++) {
            var ang = Math.random() * Math.PI * 2;
            var spd = 2.2 + Math.random() * 3.4;
            var roll = Math.random();
            parts.push({
                type: 'star', x: x, y: y,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1.6,
                g: 0.11, drag: 0.985,
                rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3,
                r: 3.5 + Math.random() * 4,
                life: 1, decay: 0.012 + Math.random() * 0.012,
                color: roll < 0.18 ? MINT : roll < 0.6 ? ACCENT : LIGHT
            });
        }
        // 잔 반짝이 — 가볍게 떠다니며 깜빡임
        for (var j = 0; j < 4; j++) {
            var a2 = Math.random() * Math.PI * 2;
            var s2 = 1 + Math.random() * 2.4;
            parts.push({
                type: 'dot', x: x, y: y,
                vx: Math.cos(a2) * s2, vy: Math.sin(a2) * s2 - 0.8,
                g: 0.05, drag: 0.99,
                r: 0.8 + Math.random() * 1.4,
                life: 1, decay: 0.02 + Math.random() * 0.02,
                tw: Math.random() * Math.PI * 2,
                color: Math.random() < 0.3 ? MINT : LIGHT
            });
        }
        // 확산 링
        parts.push({ type: 'ring', x: x, y: y, r: 6, vrad: 3.2, life: 1, decay: 0.028, color: ACCENT });

        if (!running) {
            running = true;
            last = performance.now();
            requestAnimationFrame(tick);
        }
    }

    function tick(now) {
        var dt = Math.min((now - last) / 16.67, 2); // 프레임 드랍 시에도 속도 일정
        last = now;
        // 캔버스 전체를 지운다 — 보이는 영역이 바뀌어도 잔상이 남지 않는다
        clearAll();

        for (var i = parts.length - 1; i >= 0; i--) {
            var p = parts[i];
            p.life -= p.decay * dt;
            if (p.life <= 0) { parts.splice(i, 1); continue; }

            if (p.type === 'ring') {
                p.r += p.vrad * dt;
                p.vrad *= Math.pow(0.96, dt);
                ctx.globalAlpha = p.life * 0.8;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.stroke();
                continue;
            }

            p.vy += p.g * dt;
            p.vx *= Math.pow(p.drag, dt);
            p.vy *= Math.pow(p.drag, dt);
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // 보이는 영역 밖으로 나간 입자는 즉시 정리
            if (p.x < -60 || p.x > view.w + 60 || p.y > view.h + 60) { parts.splice(i, 1); continue; }

            if (p.type === 'star') {
                p.rot += p.vr * dt;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.globalAlpha = Math.min(1, p.life * 1.6);
                ctx.fillStyle = p.color;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.r * 0.9; // 두꺼운 라운드 스트로크로 젤리 느낌
                ctx.lineJoin = 'round';
                starPath(ctx, p.r * (0.5 + p.life * 0.5));
                ctx.stroke();
                ctx.fill();
                ctx.restore();
            } else {
                var twinkle = 0.6 + 0.4 * Math.sin(now / 80 + p.tw);
                ctx.globalAlpha = Math.max(0, p.life) * twinkle;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        if (parts.length) requestAnimationFrame(tick);
        else { running = false; clearAll(); }
    }

    function isTextField(el) {
        if (!el) return false;
        var tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
    }

    document.addEventListener('click', function (e) {
        measure();

        // 확대된 상태에서는 파티클을 띄우지 않는다 (좌표·배율이 어긋나 화면을 뒤덮는다)
        if (view.s > 1.05) return;

        // 입력창 탭은 키보드를 여닫으며 레이아웃을 흔든다 — 이펙트 대상에서 제외
        if (isTextField(e.target) || (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]'))) return;
        if (isTextField(document.activeElement)) return;

        var x = e.clientX - view.x;   // 레이아웃 뷰포트 좌표 → 보이는 영역 좌표
        var y = e.clientY - view.y;
        if (x < 0 || y < 0 || x > view.w || y > view.h) return;

        burst(x, y);
    });
})();
````


## `supabase/schema.sql`

> 64줄 · 2796바이트

최초 스키마 — posts · reactions · RLS · delete_post · 환영 글 seed. 주의: 여기 orbit check는 아직 옛 값(free/money/dawn)이라 이것만 실행하면 글 작성이 23514로 실패한다.

````sql
-- ============================================
-- Orbit 광장 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ============================================

-- 궤적(글)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  nick text not null check (char_length(nick) between 2 and 12),
  orbit text not null check (orbit in ('free', 'money', 'dawn')),
  text text not null check (char_length(text) between 1 and 500),
  author_device text,                          -- 작성 기기 식별 (삭제 권한 확인용)
  created_at timestamptz not null default now()
);

-- 이모지 교차 리액션
create table if not exists public.reactions (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  emoji text not null check (emoji in ('⭐','🔥','😂','🥰','👏','❤️')),
  device_id text not null check (char_length(device_id) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (post_id, emoji, device_id)  -- 같은 기기는 글당 이모지 하나씩
);

-- 조회 인덱스
create index if not exists posts_orbit_created on public.posts (orbit, created_at desc);
create index if not exists rx_post on public.reactions (post_id);

-- Row Level Security
alter table public.posts enable row level security;
alter table public.reactions enable row level security;

-- 누구나 읽기 가능
create policy "posts_read" on public.posts for select using (true);
create policy "rx_read"    on public.reactions for select using (true);

-- 누구나 쓰기 가능 (입력값 제한은 위의 check 제약이 담당)
create policy "posts_insert" on public.posts for insert with check (true);
create policy "rx_insert"    on public.reactions for insert with check (true);

-- 리액션 취소 허용
-- (베타: 익명 구조라 device_id 소유 검증은 불가. 정식 계정 도입 시 auth.uid() 기반으로 강화)
create policy "rx_delete" on public.reactions for delete using (true);

-- 글 삭제: 작성한 기기에서만 가능하도록 RPC로 제한
-- (posts에는 직접 delete 정책을 두지 않음 → 임의 삭제 차단,
--  이 함수만 security definer로 author_device 일치 시 삭제)
create or replace function public.delete_post(p_id uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.posts where id = p_id and author_device = p_device;
end;
$$;

grant execute on function public.delete_post(uuid, text) to anon;

-- 환영 글
insert into public.posts (nick, orbit, text)
values ('Orbit', 'free', '광장이 정식으로 열렸습니다! 이제 궤적이 모두에게 보여요. 첫 궤적을 남겨보세요 🧡');
````


## `supabase/migration_002_delete.sql`

> 24줄 · 949바이트

author_device 컬럼과 delete_post RPC(기기 일치 시에만 삭제).

````sql
-- ============================================
-- 마이그레이션 002 — 글 삭제 기능
-- 이미 schema.sql을 적용한 프로젝트에서 추가로 실행
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ============================================

-- 작성 기기 식별 컬럼 (삭제 권한 확인용)
alter table public.posts add column if not exists author_device text;

-- 글 삭제: 작성한 기기에서만 가능하도록 RPC로 제한
-- posts에 직접 delete 정책을 두지 않으므로 임의 삭제는 차단되고,
-- 이 함수만 security definer로 author_device가 일치할 때 삭제한다.
create or replace function public.delete_post(p_id uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.posts where id = p_id and author_device = p_device;
end;
$$;

grant execute on function public.delete_post(uuid, text) to anon;
````


## `supabase/migration_003_rate_limit.sql`

> 61줄 · 2269바이트

글 도배 방지 — author_device NOT NULL(NOT VALID) + 1분 3개 / 1시간 20개 트리거. 예외 이름 orbit_rate_limit을 클라이언트가 읽는다.

````sql
-- ============================================
-- 도배 방지: 궤적(글) 작성 속도 제한
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- 익명 구조라 완벽할 수는 없다 — 기기 ID(localStorage)를 지우면
-- 새 기기가 되므로 작정한 공격자는 우회할 수 있다.
-- 그래도 실수 연타와 단순 스크립트 도배는 여기서 걸린다.
-- IP 기반 제한이 필요해지면 쓰기를 Edge Function 뒤로 옮기는 게 다음 단계.
--
-- 클라이언트(lounge.html의 errHint)는 'orbit_rate_limit' 메시지를 보고
-- "너무 빠르게 남기고 있어요" 안내를 띄우므로 예외 문구를 바꾸면 같이 바꿀 것.

-- 새 글은 작성 기기 식별자를 반드시 갖도록 한다 (제한 우회용 null 차단).
-- NOT VALID: 기존 행(초기 환영 글 등)은 검사하지 않고 새 insert에만 적용된다.
alter table public.posts
  drop constraint if exists posts_author_device_required;
alter table public.posts
  add constraint posts_author_device_required
  check (author_device is not null and char_length(author_device) between 8 and 64)
  not valid;

create or replace function public.posts_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  -- 같은 기기에서 1분에 3개까지
  select count(*) into recent
    from public.posts
   where author_device = new.author_device
     and created_at > now() - interval '1 minute';
  if recent >= 3 then
    raise exception 'orbit_rate_limit';
  end if;

  -- 같은 기기에서 1시간에 20개까지
  select count(*) into recent
    from public.posts
   where author_device = new.author_device
     and created_at > now() - interval '1 hour';
  if recent >= 20 then
    raise exception 'orbit_rate_limit';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit
  before insert on public.posts
  for each row execute function public.posts_rate_limit();

-- 속도 제한 카운트 조회용 인덱스 (author_device + 시간)
create index if not exists posts_device_created
  on public.posts (author_device, created_at desc);
````


## `supabase/migration_004_comments.sql`

> 95줄 · 3698바이트

댓글 테이블 · delete_comment RPC · 1분 5개 / 1시간 50개 트리거. 글보다 느슨하고 300자 제한.

````sql
-- ============================================
-- 댓글 — 궤적에 달리는 답
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- posts와 같은 원칙을 그대로 따른다:
--   · 읽기·쓰기는 누구나 (입력 제한은 check 제약이 담당)
--   · 삭제는 작성한 기기에서만 — delete 정책을 두지 않고 RPC로만 연다
--   · 도배 방지는 insert 트리거
--
-- 글보다 댓글이 자연스럽게 더 자주 달리므로 속도 제한은 조금 느슨하게 잡았다.
-- 글자 수도 500자가 아니라 300자 — 길어지면 그건 댓글이 아니라 새 궤적이다.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  nick text not null check (char_length(nick) between 2 and 12),
  text text not null check (char_length(text) between 1 and 300),
  author_device text not null check (char_length(author_device) between 8 and 64),
  created_at timestamptz not null default now()
);

-- 글 하나의 댓글을 시간순으로 읽는 조회에 맞춘 인덱스
create index if not exists comments_post_created
  on public.comments (post_id, created_at);

-- 도배 방지 트리거가 매 insert마다 세는 구간 조회용
create index if not exists comments_device_created
  on public.comments (author_device, created_at desc);

alter table public.comments enable row level security;

drop policy if exists "comments_read" on public.comments;
create policy "comments_read" on public.comments for select using (true);

drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments for insert with check (true);

-- delete 정책을 일부러 만들지 않는다 → REST로는 남의 댓글을 지울 수 없다.
-- 작성 기기가 일치할 때만 지우는 아래 함수를 통해서만 삭제된다.
create or replace function public.delete_comment(p_id uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.comments where id = p_id and author_device = p_device;
end;
$$;

grant execute on function public.delete_comment(uuid, text) to anon;

-- ===== 도배 방지 =====
-- posts와 마찬가지로 익명 구조라 완벽하지 않다 — 기기 ID(localStorage)를 지우면
-- 새 기기가 되므로 작정한 공격자는 우회할 수 있다. 실수 연타와 단순 스크립트
-- 도배를 막는 것이 목적이다.
--
-- 클라이언트(lounge.html의 errHint)가 'orbit_comment_rate_limit' 문구를 보고
-- 안내를 띄우므로, 예외 이름을 바꾸면 그쪽도 같이 바꿀 것.
create or replace function public.comments_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  -- 같은 기기에서 1분에 5개까지
  select count(*) into recent
    from public.comments
   where author_device = new.author_device
     and created_at > now() - interval '1 minute';
  if recent >= 5 then
    raise exception 'orbit_comment_rate_limit';
  end if;

  -- 같은 기기에서 1시간에 50개까지
  select count(*) into recent
    from public.comments
   where author_device = new.author_device
     and created_at > now() - interval '1 hour';
  if recent >= 50 then
    raise exception 'orbit_comment_rate_limit';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.comments_rate_limit();
````


## `supabase/migration_005_admin.sql`

> 143줄 · 5994바이트

관리자 체계의 핵심. admins 테이블(RLS 켜고 정책 0개) · is_admin() · 관리자 delete 정책 · delete_reaction RPC · reaction_summary(device_id 비노출) · reaction_counts. 운영 UID는 의도적으로 주석 처리돼 레포에 없다.

````sql
-- ============================================
-- 관리자(마스터) 계정 — 모든 궤적·답 삭제 권한
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- 【먼저 할 일】
--   1) Authentication → Users → Add user 로 관리자 계정을 하나 만든다.
--      이때 'Auto Confirm User'를 켠다. 안 켜면 인증 메일을 받을 수 없어
--      로그인이 'Email not confirmed'로 막힌다.
--   2) 그 계정의 User UID를 복사해 아래 ADMIN_UID 자리에 붙여넣는다.
--   3) 이 파일 전체를 Run 한다.
--
-- 【설계 원칙】
--   권한의 근거는 "로그인했다"가 아니라 "admins 테이블에 있다"이다.
--   그래서 혹시 누가 가입에 성공하더라도 아무 권한 없는 일반 계정일 뿐이다.
--   (가입 차단은 위생 조치이고, 보안의 경계선은 이 테이블이다)
--
--   판정은 전부 서버(RLS)에서 한다. 클라이언트가 보내는 값으로 권한을
--   정하지 않으므로, 브라우저 쪽 코드를 조작해도 남의 글을 지울 수 없다.

-- ===== 관리자 명단 =====
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

-- RLS를 켜되 정책은 하나도 두지 않는다 →
-- 이 테이블은 REST로 아무도 읽거나 쓸 수 없다.
-- 아래 is_admin()만 security definer로 우회해서 읽는다.
-- (관리자 명단이 공개되면 누구를 노려야 하는지 알려주는 셈이 된다)
alter table public.admins enable row level security;

-- ===== 관리자 여부 =====
-- security definer라 admins의 RLS를 통과해 읽을 수 있다.
-- auth.uid()는 요청에 실린 JWT에서 서버가 직접 꺼내므로 위조할 수 없다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ===== 삭제 권한 =====
-- 기존 구조는 그대로 둔다: 일반 사용자는 delete 정책이 없어 REST로는 못 지우고,
-- 작성 기기가 일치할 때만 delete_post / delete_comment RPC로 지운다.
-- 여기에 관리자용 정책을 더해, 로그인한 관리자만 REST delete가 통과되게 한다.

drop policy if exists "posts_admin_delete" on public.posts;
create policy "posts_admin_delete" on public.posts
  for delete to authenticated using (public.is_admin());

drop policy if exists "comments_admin_delete" on public.comments;
create policy "comments_admin_delete" on public.comments
  for delete to authenticated using (public.is_admin());

-- ===== 리액션 삭제 구멍 막기 =====
-- 기존 정책은 rx_delete가 using (true)라, REST로 아무나 남의 리액션을
-- 지울 수 있었다. 리액션 취소는 아래 RPC로만 가능하게 좁히고,
-- 정책은 관리자에게만 남긴다.
drop policy if exists "rx_delete" on public.reactions;
create policy "rx_admin_delete" on public.reactions
  for delete to authenticated using (public.is_admin());

-- 내 리액션 취소 — 기기가 일치할 때만 지운다
create or replace function public.delete_reaction(p_post_id uuid, p_emoji text, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.reactions
   where post_id = p_post_id and emoji = p_emoji and device_id = p_device;
end;
$$;

grant execute on function public.delete_reaction(uuid, text, text) to anon, authenticated;

-- ===== 리액션 집계 =====
-- 지금까지는 클라이언트가 reactions 행을 통째로 받아 device_id까지 봤다.
-- 그러면 남의 기기 ID가 전부 노출돼서, 위 RPC가 있어도 그 값을 그대로 넣어
-- 남의 리액션을 지울 수 있다. 개수와 "내가 눌렀는지"만 돌려주고
-- device_id 자체는 밖으로 내보내지 않는다.
create or replace function public.reaction_summary(p_post_ids uuid[], p_device text)
returns table (post_id uuid, emoji text, n bigint, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.post_id,
         r.emoji,
         count(*) as n,
         bool_or(r.device_id = p_device) as mine
    from public.reactions r
   where r.post_id = any(p_post_ids)
   group by r.post_id, r.emoji;
$$;

grant execute on function public.reaction_summary(uuid[], text) to anon, authenticated;

-- reactions를 직접 select 하는 경로도 device_id를 흘리므로 닫는다.
-- 읽기는 위 reaction_summary로만 한다.
-- (main.html의 Trending은 post_id만 세므로 아래 집계 함수로 옮긴다)
drop policy if exists "rx_read" on public.reactions;

create or replace function public.reaction_counts(p_limit int default 1000)
returns table (post_id uuid, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.post_id, count(*) as n
    from public.reactions r
   group by r.post_id
   order by n desc
   limit p_limit;
$$;

grant execute on function public.reaction_counts(int) to anon, authenticated;

-- ===== 관리자 등록 =====
-- 아래 'ADMIN_UID_HERE'를 Authentication → Users에서 복사한 User UID로 바꾼다.
-- 예: insert into public.admins (user_id, note) values ('a1b2c3d4-...', '운영자');
--
-- UID를 아직 모르면 이 줄만 빼고 나머지를 먼저 Run 해도 된다.
-- 나중에 이 한 줄만 다시 실행하면 관리자로 등록된다.

-- insert into public.admins (user_id, note)
-- values ('ADMIN_UID_HERE', '운영자')
-- on conflict (user_id) do nothing;

-- ===== 등록 확인 =====
-- 아래를 실행해 관리자 계정이 제대로 들어갔는지 볼 수 있다.
-- select u.email, a.note, a.created_at
--   from public.admins a join auth.users u on u.id = a.user_id;
````


## `supabase/migration_006_pet_orbit.sql`

> 23줄 · 1073바이트

orbit 제약에 'pet' 추가. 채널을 늘릴 때 제약을 어떻게 다시 만드는지 보여주는 본보기.

````sql
-- ============================================
-- 반려동물 궤도 추가
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- posts.orbit은 허용 값을 check 제약으로 잠가두었다.
-- lounge.html의 ORBIT_LIST에 줄을 하나 더해도 이 제약을 풀지 않으면
-- 새 궤도에 글을 쓸 때 23514(check constraint) 오류가 난다.
--
-- 제약 이름은 schema.sql에서 인라인으로 선언해 Postgres가 자동으로 붙인
-- posts_orbit_check이다. 혹시 이름이 다르면 아래 쿼리로 확인할 수 있다:
--   select conname from pg_constraint
--    where conrelid = 'public.posts'::regclass and contype = 'c';

alter table public.posts
  drop constraint if exists posts_orbit_check;

alter table public.posts
  add constraint posts_orbit_check
  check (orbit in ('free', 'money', 'dawn', 'pet'));

-- 참고: 궤도를 더 늘릴 때도 이 파일과 같은 방식으로
-- 제약을 다시 만들어 주면 된다. 기존 글의 orbit 값은 그대로 유지된다.
````


## `supabase/migration_007_reports.sql`

> 157줄 · 6286바이트

신고 — reports 테이블(대상·기기 유니크) · 관리자 전용 read/update 정책 · 도배 방지 트리거 · report_queue()(신고와 신고당한 내용을 함께) · resolve_report()(대상 삭제 여부를 받아 같은 대상의 신고를 일괄 처리).

````sql
-- ============================================
-- 신고 — 이용자가 문제 있는 궤적·답을 알리는 경로
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- 관리자 삭제(migration_005)만으로는 부족하다. 운영자가 24시간 광장을
-- 보고 있을 수 없으므로, 문제를 먼저 보는 사람은 언제나 이용자다.
-- 지금은 그 사람이 알릴 방법이 아예 없다.
--
-- 【설계】
--   · 신고는 누구나 남길 수 있다 (로그인 없는 구조 유지)
--   · 신고 내역은 관리자만 읽는다 — 누가 누구를 신고했는지가 공개되면
--     보복이 생기고, 신고 자체를 안 하게 된다
--   · 같은 기기가 같은 대상을 여러 번 신고해도 한 건으로 친다
--   · 도배 방지는 글·댓글과 같은 트리거 방식

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'abuse', 'adult', 'privacy', 'etc')),
  detail text check (detail is null or char_length(detail) <= 200),
  reporter_device text not null check (char_length(reporter_device) between 8 and 64),
  handled boolean not null default false,
  created_at timestamptz not null default now(),
  -- 한 기기가 같은 대상을 반복 신고해 목록을 채우지 못하게 한다.
  -- 클라이언트는 여기서 나는 23505를 "이미 신고함"으로 안내한다.
  unique (target_type, target_id, reporter_device)
);

-- 관제실 목록은 미처리 → 최신 순으로 본다
create index if not exists reports_queue on public.reports (handled, created_at desc);
-- 도배 방지 트리거가 세는 구간
create index if not exists reports_device_created on public.reports (reporter_device, created_at desc);

alter table public.reports enable row level security;

-- 신고 접수는 누구나. 입력 제한은 위의 check가 담당한다.
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports for insert with check (true);

-- 읽기·수정은 관리자만. select 정책을 열어두면 신고자 기기 ID와
-- "무엇이 신고당했는지"가 그대로 노출된다.
drop policy if exists "reports_admin_read" on public.reports;
create policy "reports_admin_read" on public.reports
  for select to authenticated using (public.is_admin());

drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_admin_update" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== 도배 방지 =====
-- 클라이언트(lounge.html의 errHint)가 'orbit_report_rate_limit'를 보고
-- 안내를 띄우므로 예외 이름을 바꾸면 그쪽도 같이 바꿀 것.
create or replace function public.reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  select count(*) into recent
    from public.reports
   where reporter_device = new.reporter_device
     and created_at > now() - interval '1 minute';
  if recent >= 5 then
    raise exception 'orbit_report_rate_limit';
  end if;

  select count(*) into recent
    from public.reports
   where reporter_device = new.reporter_device
     and created_at > now() - interval '1 hour';
  if recent >= 30 then
    raise exception 'orbit_report_rate_limit';
  end if;

  return new;
end;
$$;

drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit
  before insert on public.reports
  for each row execute function public.reports_rate_limit();

-- ===== 관제실 목록 =====
-- 신고만 봐서는 조치할 수 없다. 신고당한 내용이 함께 보여야 한다.
-- security definer라 RLS를 지나치므로 함수 안에서 관리자 여부를 직접 막는다.
--
-- target_exists가 false면 이미 지워진 대상이다 — 목록에는 남겨서
-- "처리됨"을 누를 수 있게 한다.
create or replace function public.report_queue()
returns table (
  id uuid, target_type text, target_id uuid, reason text, detail text,
  created_at timestamptz, handled boolean,
  nick text, content text, orbit text, target_exists boolean, dup_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.target_type, r.target_id, r.reason, r.detail,
         r.created_at, r.handled,
         coalesce(p.nick, c.nick) as nick,
         coalesce(p.text, c.text) as content,
         p.orbit,
         (p.id is not null or c.id is not null) as target_exists,
         (select count(*) from public.reports r2
           where r2.target_type = r.target_type and r2.target_id = r.target_id) as dup_count
    from public.reports r
    left join public.posts    p on r.target_type = 'post'    and p.id = r.target_id
    left join public.comments c on r.target_type = 'comment' and c.id = r.target_id
   where public.is_admin()
   order by r.handled asc, r.created_at desc
   limit 200;
$$;

grant execute on function public.report_queue() to authenticated;

-- ===== 처리 =====
-- 대상을 지울지 여부를 받아서, 같은 대상에 달린 신고를 한꺼번에 처리됨으로 바꾼다.
-- (한 글에 신고가 여러 건이면 하나씩 닫는 건 의미가 없다)
create or replace function public.resolve_report(p_report_id uuid, p_delete_target boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reports;
begin
  if not public.is_admin() then
    raise exception 'orbit_not_admin';
  end if;

  select * into r from public.reports where id = p_report_id;
  if not found then return; end if;

  if p_delete_target then
    if r.target_type = 'post' then
      delete from public.posts where id = r.target_id;   -- 댓글·리액션은 cascade
    else
      delete from public.comments where id = r.target_id;
    end if;
  end if;

  update public.reports
     set handled = true
   where target_type = r.target_type and target_id = r.target_id;
end;
$$;

grant execute on function public.resolve_report(uuid, boolean) to authenticated;
````


## `supabase/migration_008_sky_orbits.sql`

> 55줄 · 2697바이트

방향 전환 마이그레이션. orbit 제약에 report/gear/live/ask 추가. 옛 값 4개도 함께 허용해야 기존 행이 ALTER를 실패시키지 않는다. 하단에 옛 글 정리용 3단계 쿼리가 주석으로 있다. 미적용 시 글 작성 불가.

````sql
-- ============================================
-- 궤도(채널) 개편 — 잡담형 → 천문 관측 주제
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ============================================
--
-- 2026-08 방향 전환에 맞춰 lounge.html의 ORBIT_LIST를 갈아끼웠다.
--   관측 후기(report) · 장비(gear) · 실시간 하늘(live) · 질문(ask)
--
-- 【옛 id를 재사용하지 않은 이유】
--   free/money/dawn/pet 을 그대로 두고 이름표만 바꾸면(migration_006에서
--   'dawn'을 운동 궤도로 넓혔던 것처럼) 이미 쌓인 재테크 글이 '장비'로,
--   반려동물 글이 '질문'으로 둔갑한다. 이번엔 이름이 넓어진 게 아니라
--   주제가 통째로 바뀐 것이라 새 id를 쓴다.
--
-- 【옛 값을 제약에서 빼지 않는 이유】
--   check 제약을 새로 추가하면 Postgres가 기존 행을 전부 검사한다.
--   옛 값을 빼면 이미 있는 글들이 제약 위반이라 ALTER 자체가 실패한다.
--   그래서 옛 4개 + 새 4개를 모두 허용한다. 옛 글은 lounge.html의
--   orbitInfo() 폴백을 타서 🛰️ 칩에 원래 id가 찍힌 채로 그대로 보인다
--   (탭 목록에는 새 4개만 뜨므로 '전체'에서만 만나게 된다).
--
-- 제약 이름은 schema.sql에서 인라인 선언돼 Postgres가 붙인 posts_orbit_check이다.
-- 혹시 이름이 다르면 아래로 확인할 수 있다:
--   select conname from pg_constraint
--    where conrelid = 'public.posts'::regclass and contype = 'c';

alter table public.posts
  drop constraint if exists posts_orbit_check;

alter table public.posts
  add constraint posts_orbit_check
  check (orbit in (
    -- 현재 궤도
    'report', 'gear', 'live', 'ask',
    -- 지난 궤도 (기존 글 보존용 — 새 글은 UI에서 선택할 수 없다)
    'free', 'money', 'dawn', 'pet'
  ));

-- ===== 옛 글을 정리하고 싶다면 =====
-- 아래는 실행하지 않아도 서비스는 정상 동작한다. 필요할 때만 골라 쓸 것.
--
-- 1) 옛 글이 몇 건이나 남아 있는지 본다
-- select orbit, count(*) from public.posts
--  where orbit in ('free','money','dawn','pet')
--  group by orbit order by count(*) desc;
--
-- 2) 옛 글을 전부 '질문' 궤도로 옮긴다 (되돌릴 수 없다)
-- update public.posts set orbit = 'ask'
--  where orbit in ('free','money','dawn','pet');
--
-- 3) 옛 글을 다 옮겼거나 지웠다면 제약에서 옛 값을 뺀다
-- alter table public.posts drop constraint if exists posts_orbit_check;
-- alter table public.posts
--   add constraint posts_orbit_check
--   check (orbit in ('report', 'gear', 'live', 'ask'));
````


## `supabase/migrate_emoji_2026-07.sql`

> 20줄 · 1123바이트

리액션 이모지 이전 — 구형 기기에서 깨지던 유니코드 14 이모지 교체(🥹→🥰, 🫶→❤️).

````sql
-- ============================================
-- 공감 이모지 교체 마이그레이션 (2026-07)
-- 🥹 → 🥰, 🫶 → ❤️ (구형 기기에서 □로 깨지는 유니코드 14 이모지 제거)
--
-- 이미 schema.sql을 실행해 둔 기존 Supabase 프로젝트에서
-- SQL Editor 에 이 파일을 붙여넣고 Run 하세요.
-- (새 프로젝트라면 최신 schema.sql만 실행하면 되고 이 파일은 필요 없습니다)
-- ============================================

-- 1) 옛 이모지 목록으로 걸려 있는 check 제약 해제
alter table public.reactions drop constraint if exists reactions_emoji_check;

-- 2) 이미 쌓인 리액션을 새 이모지로 이전
--    (🥰/❤️는 옛 목록에 없던 값이라 unique(post_id, emoji, device_id) 충돌 없음)
update public.reactions set emoji = '🥰' where emoji = '🥹';
update public.reactions set emoji = '❤️' where emoji = '🫶';

-- 3) 새 이모지 목록으로 check 제약 재설정
alter table public.reactions add constraint reactions_emoji_check
  check (emoji in ('⭐','🔥','😂','🥰','👏','❤️'));
````


## `robots.txt`

> 6줄 · 110바이트

admin.html과 _archive/ 차단, sitemap 위치.

````text
User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /_archive/

Sitemap: https://orbithere.com/sitemap.xml
````


## `sitemap.xml`

> 33줄 · 878바이트

6개 URL. admin.html과 _archive/는 넣지 않는다.

````xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://orbithere.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://orbithere.com/sky.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://orbithere.com/main.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://orbithere.com/lounge.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://orbithere.com/terms.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://orbithere.com/privacy.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
````


## `site.webmanifest`

> 16줄 · 611바이트

PWA 매니페스트(standalone, 아이콘 4종).

````json
{
  "name": "Orbit — 궤도에서 너를 만나다",
  "short_name": "Orbit",
  "description": "비슷한 궤도를 도는 사람들이 모이는 곳",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0F172A",
  "theme_color": "#0F172A",
  "icons": [
    { "src": "/favicon-32.png", "sizes": "32x32", "type": "image/png" },
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
````


## `CNAME`

> 1줄 · 13바이트

GitHub Pages 커스텀 도메인.

````text
orbithere.com
````


## `favicon.svg`

> 9줄 · 533바이트

파비콘 — 젤리별 SVG.

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#0F172A"/>
  <g transform="rotate(-18 50 50)">
    <ellipse cx="50" cy="53" rx="40" ry="13.5" fill="none" stroke="#4FD1C5" stroke-width="4"/>
  </g>
  <g transform="translate(50 50) scale(0.62) translate(-50 -47)">
    <path d="M 50 15 L 62 34 L 83 39 L 69 56 L 71 78 L 50 70 L 29 78 L 31 56 L 17 39 L 38 34 Z" fill="#FF9F43" stroke="#FF9F43" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/>
  </g>
</svg>
````


## `README.md`

> 48줄 · 2539바이트

레포 README. 페이지 구성 · 기술 · Supabase 설정 · 저작권 안내(오픈소스 아님).

````markdown
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

궤도(채널)는 **관측 후기 · 장비 · 실시간 하늘 · 질문** 네 개입니다.
채널을 늘리거나 바꿀 때는 `lounge.html`의 `ORBIT_LIST`와 DB의 `posts_orbit_check` 제약을
**같이** 고쳐야 합니다 (`supabase/migration_008_sky_orbits.sql` 참고).

`_archive/`에는 사이트에서 내렸지만 지우지 않은 페이지가 있습니다 — `_archive/README.md` 참고.

## 기술

- 프레임워크 없는 순수 HTML/CSS/JS 정적 사이트 (빌드 스텝 없음)
- 호스팅: GitHub Pages · 데이터베이스: Supabase · 폰트: Pretendard
- 로그인 없음. 닉네임과 기기 식별자를 localStorage에 두고, 권한 판정은 전부 Postgres RLS가 합니다

## Supabase 설정

`supabase/` 안의 SQL을 **번호 순서대로** SQL Editor에서 실행하세요.
`schema.sql`만 실행하면 채널 제약이 옛 값에 머물러 글 작성이 23514로 막힙니다.

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
````


## `_archive/README.md`

> 33줄 · 2201바이트

내린 페이지 보관 안내 — 왜 밑줄 디렉터리인지, 되살리는 방법, 되살릴 때 다시 연결할 곳 목록.

````markdown
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
````


---

## 저작권

© 2026 Orbit (orbithere.com). All rights reserved.
이 코드는 오픈소스가 아닙니다. GitHub Pages 배포를 위해 레포가 공개되어 있을 뿐이며
별도의 라이선스를 부여하지 않습니다. 자세한 내용은 위 `README.md`의 저작권 안내를 보세요.

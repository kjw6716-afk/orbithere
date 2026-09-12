#!/usr/bin/env python3
"""Generate the static shared menu; --check detects drift without a site build."""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MENU = [
    ('sky', '🔭', '밤하늘 달력', 'main.html#sky'),
    ('planets', '🪐', '오늘 밤 행성', 'main.html#planets'),
    ('lounge', '💬', '별빛 게시판', 'main.html#lounge'),
    ('news', '📰', '우주 뉴스', 'news.html'),
    ('guide', '📖', '관측 가이드', 'guide.html'),
    ('stories', '✦', '우주 이야기', 'stories.html'),
    ('about', 'ⓘ', '소개·문의', 'about.html'),
]
PAGES = {'main': 'planets', **{key: key for key, *_ in MENU},
         'reading-sky': 'guide', 'notes': None, 'terms': None, 'privacy': None, 'admin': None}
PATTERN = r'<!-- orbit-navigation:start -->.*?<!-- orbit-navigation:end -->'

def render(page, active, prefix=''):
    current = next((m for m in MENU if m[0] == active), ('', '☰', '메뉴', ''))
    rows = []
    for key, icon, label, href in MENU:
        selected = ' on' if key == active else ''
        aria = ' aria-current="page"' if selected else ''
        content = f'<span class="ic" aria-hidden="true">{icon}</span><span class="lbl">{label}</span>'
        if page == 'main' and key in ('sky', 'planets', 'lounge'):
            rows.append(f'<button type="button" class="nav-item{selected}" data-panel="{key}"{aria}>{content}</button>')
        else:
            rows.append(f'<a class="nav-item nav-link{selected}" href="{prefix}{href}"{aria}>{content}</a>')
    return '\n'.join([
        '<!-- orbit-navigation:start -->',
        '<aside class="sidebar orbit-navigation">',
        f'<a class="side-logo orbit-brand" href="{prefix}index.html" aria-label="ORBIT 홈">ORBIT.</a>',
        '<button class="nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="sideNav" aria-label="메뉴 열기">',
        f'<span class="nt-ic" id="navToggleIc" aria-hidden="true">{current[1]}</span>',
        f'<span class="nt-lbl" id="navToggleLbl">{current[2]}</span><span class="nt-arrow" aria-hidden="true"></span></button>',
        '<nav class="side-nav" id="sideNav" aria-label="주요 메뉴">',
        *rows, '</nav></aside>', '<div class="nav-scrim" id="navScrim" aria-hidden="true"></div>',
        '<!-- orbit-navigation:end -->',
    ])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    drift = []
    pages = {**PAGES, **{f'stories/{p.stem}': 'stories' for p in (ROOT / 'stories').glob('*.html')}}
    for page, active in pages.items():
        path = ROOT / f'{page}.html'
        text = path.read_text()
        if len(re.findall(PATTERN, text, re.S)) != 1:
            raise ValueError(f'{path.name}: expected one shared navigation block')
        updated = re.sub(PATTERN, lambda _: render(page, active, '../' if '/' in page else ''), text, flags=re.S)
        if updated != text:
            drift.append(path.name)
            if not args.check:
                path.write_text(updated)
    if args.check and drift:
        raise SystemExit('Run python3 scripts/site_navigation.py: ' + ', '.join(drift))
    print(f'Shared navigation: {len(pages)} pages checked.')

if __name__ == '__main__':
    main()

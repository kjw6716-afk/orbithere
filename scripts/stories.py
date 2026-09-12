#!/usr/bin/env python3
"""Validate approved editorial files, publish at most one per KST day, render static pages.

AI drafts arrive in pull requests. Merging an article file is the editorial approval.
This renderer never calls a model or treats a successful syntax check as fact checking.
"""
import argparse
from datetime import date, datetime
import hashlib
from html import escape
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from site_navigation import editor_star, render as navigation

ROOT = Path(__file__).resolve().parents[1]
ARTICLE_DIR = '_editorial/articles'
LEDGER = '_editorial/published.json'
CATEGORIES = ('달과 행성', '별과 우주', '우주 탐사', '관측 이야기')
SOURCE_DOMAINS = ('nasa.gov', 'esa.int', 'kasi.re.kr', 'imo.net', 'noaa.gov',
                  'spacex.com', 'rocketlabusa.com', 'blueorigin.com', 'fireflyspace.com')
RELATED = {'sky.html', 'planets.html', 'guide.html', 'reading-sky.html', 'news.html', 'lounge.html'}
# Operator-approved launch batch only; scheduled publishing remains one per KST day.
INITIAL_RELEASE_DAY = '2026-09-12'
INITIAL_RELEASE_IDS = {'moon-face-and-phases', 'seasonal-constellations-camping', 'cosmic-voids'}


def text(value, low=1, high=500):
    if not isinstance(value, str) or not low <= len(value.strip()) <= high:
        raise ValueError('Text is missing or outside the allowed length')
    if any(ord(c) < 32 and c not in '\n\t' for c in value):
        raise ValueError('Control characters are not allowed')
    return value.strip()


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('Dates must be YYYY-MM-DD')
    date.fromisoformat(value)
    return value


def official_url(value):
    value = text(value, high=1000)
    url = urlsplit(value)
    host = url.hostname or ''
    if url.scheme != 'https' or url.username or url.password or url.port not in (None, 443):
        raise ValueError('Source must use HTTPS without credentials or a custom port')
    if not any(host == d or host.endswith('.' + d) for d in SOURCE_DOMAINS):
        raise ValueError('Source domain is not an approved primary source')
    return value


def content_hash(article):
    return hashlib.sha256(json.dumps(article, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def validate_article(article):
    if not isinstance(article, dict) or article.get('version') != 1:
        raise ValueError('Unsupported article schema')
    if not re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*', article.get('id', '')) or len(article['id']) > 70:
        raise ValueError('Invalid article ID')
    text(article['title'], 8, 80)
    text(article['summary'], 20, 180)
    text(article['takeaway'], 20, 180)
    valid_date(article['publishAfter'])
    if article['category'] not in CATEGORIES:
        raise ValueError('Unknown category')
    sources = article['sources']
    if not isinstance(sources, list) or not 1 <= len(sources) <= 5:
        raise ValueError('Use 1–5 checked primary sources')
    for source in sources:
        text(source['title'], 3, 120)
        official_url(source['url'])
        valid_date(source['checkedAt'])
    if len({s['url'] for s in sources}) != len(sources):
        raise ValueError('Duplicate source')
    sections = article['sections']
    if not isinstance(sections, list) or not 3 <= len(sections) <= 6:
        raise ValueError('Use 3–6 sections')
    body = []
    for section in sections:
        text(section['heading'], 3, 60)
        if not isinstance(section['paragraphs'], list) or not 1 <= len(section['paragraphs']) <= 3:
            raise ValueError('Use 1–3 paragraphs per section')
        body += [text(p, 20, 650) for p in section['paragraphs']]
        refs = section['sources']
        if not isinstance(refs, list) or not refs or any(type(n) is not int or not 1 <= n <= len(sources) for n in refs):
            raise ValueError('Every section must reference a checked source')
    if not 1000 <= len(''.join(body)) <= 1600:
        raise ValueError(f'Article body should be 1,000–1,600 Korean characters, got {len("".join(body))}')
    evidence = article['factChecks']
    if not isinstance(evidence, list) or not 2 <= len(evidence) <= 10:
        raise ValueError('Record 2–10 source comparisons for editorial review')
    for item in evidence:
        text(item['claim'], 10, 300)
        text(item['evidence'], 10, 500)
        if type(item['source']) is not int or not 1 <= item['source'] <= len(sources):
            raise ValueError('Invalid fact-check source')
    related = article['related']
    if related['href'] not in RELATED:
        raise ValueError('Invalid related destination')
    text(related['label'], 3, 60)
    text(related['description'], 10, 160)
    return article


def load(root=ROOT):
    articles = {}
    titles = set()
    for path in sorted((root / ARTICLE_DIR).glob('*.json')):
        a = validate_article(json.loads(path.read_text()))
        if path.stem != a['id'] or a['id'] in articles or a['title'] in titles:
            raise ValueError('Duplicate title/ID or filename mismatch')
        articles[a['id']] = a
        titles.add(a['title'])
    ledger = json.loads((root / LEDGER).read_text())
    if not isinstance(ledger, dict) or ledger.get('version') != 1 or not isinstance(ledger.get('items'), list):
        raise ValueError('Invalid publication ledger')
    seen, days = set(), {}
    for item in ledger['items']:
        ident, day = item['id'], valid_date(item['date'])
        if ident not in articles or ident in seen:
            raise ValueError('Missing article or duplicate article')
        if articles[ident]['publishAfter'] > day:
            raise ValueError('Article published before its allowed date')
        if item['contentHash'] != content_hash(articles[ident]):
            raise ValueError('Published article changed: use --accept-correction ID after source review')
        seen.add(ident)
        days.setdefault(day, set()).add(ident)
    for day, ids in days.items():
        if len(ids) > 1 and not (day == INITIAL_RELEASE_DAY and ids == INITIAL_RELEASE_IDS):
            raise ValueError('Duplicate publication day outside the approved initial release')
    return articles, ledger


def publish_next(articles, ledger, today):
    valid_date(today)
    if any(item['date'] == today for item in ledger['items']):
        return None
    if any(item['date'] > today for item in ledger['items']):
        raise ValueError('Clock moved before a recorded publication date')
    seen = {item['id'] for item in ledger['items']}
    queue = sorted((a for a in articles.values() if a['id'] not in seen and a['publishAfter'] <= today),
                   key=lambda a: (a['publishAfter'], a['id']))
    if not queue:
        return None
    article = queue[0]
    ledger['items'].append({'id': article['id'], 'date': today, 'contentHash': content_hash(article)})
    return article['id']


def esc(value):
    return escape(str(value), quote=True)


def json_script(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def shell(title, description, path, body, prefix='', schema=None, noindex=False, script='stories.js'):
    canonical = 'https://orbithere.com/' + path
    footer = ''.join(f'<a href="{prefix}{href}">{label}</a>' for href, label in
                     [('stories.html', '우주 이야기'), ('about.html', '소개·문의'), ('terms.html', '이용약관'), ('privacy.html', '개인정보처리방침')])
    return f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{esc(title)} | ORBIT</title>
<meta name="description" content="{esc(description)}">
<meta name="color-scheme" content="dark"><meta name="theme-color" content="#0F172A">
{'<meta name="robots" content="noindex,follow">' if noindex else ''}
<link rel="canonical" href="{canonical}">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="{'article' if schema else 'website'}"><meta property="og:site_name" content="Orbit">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{canonical}"><meta property="og:image" content="https://orbithere.com/images/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
<link rel="stylesheet" href="{prefix}orbit.css?v=20260912-brand">
<link rel="stylesheet" href="{prefix}site-nav.css?v=20260912-navigation">
<link rel="stylesheet" href="{prefix}stories.css?v=20260912-launch">
{f'<script type="application/ld+json">{json_script(schema)}</script>' if schema else ''}
<script src="{prefix}site-nav.js?v=20260912-navigation" defer></script>
<script src="{prefix}{script}?v=20260912-editor" defer></script>
<script src="{prefix}orbit-config.js"></script><script src="{prefix}visits.js" defer></script>
</head>
<body><a class="skip-link" href="#main-content">본문으로 바로가기</a>
<div class="orbit-page-layout">
{navigation('notes' if noindex else 'stories', None if noindex else 'stories', prefix)}
<div class="orbit-page-content"><main class="stories-main" id="main-content">
{body}
<footer class="stories-footer" aria-label="사이트 정보">{footer}</footer>
</main></div></div></body></html>
'''


def byline(disclose=False):
    disclosure = '<small>AI가 공식 자료를 바탕으로 작성한 글입니다.</small>' if disclose else ''
    return f'<div class="editor-sign"><span class="editor-avatar" aria-hidden="true">{editor_star(24)}</span><div><strong>ORBIT 에디터</strong>{disclosure}</div></div>'


def meta(article, day):
    return f'<div class="story-meta"><span class="story-tag">{esc(article["category"])}</span></div>'


def art(article):
    style = '' if article['category'] == '달과 행성' else ' story-art--deep-space'
    return f'<div class="story-art{style}" aria-hidden="true"><i class="spark"></i><span class="story-art-label">A LITTLE CLOSER TO SPACE</span></div>'


def render_list(items):
    head = '<header class="stories-heading"><div><p class="story-eyebrow">ORBIT STORIES</p><h1>우주를 조금 더 가까이.</h1><p class="stories-deck">궁금한 질문 하나에서 시작하는 우주 이야기.<br>어려운 말은 풀어서, 믿을 만한 자료와 함께 전해요.</p></div>' + byline() + '</header>'
    feature = '<p class="editor-note">첫 번째 이야기를 준비하고 있어요. <a href="news.html">우주 뉴스 둘러보기 →</a></p>'
    if items:
        a, day = items[0]
        feature = f'<section class="story-feature" aria-labelledby="latestStoryTitle"><div class="story-feature-copy"><p class="story-eyebrow">가장 최근의 이야기</p>{meta(a, day)}<h2 id="latestStoryTitle"><a href="stories/{a["id"]}.html">{esc(a["title"])}</a></h2><p>{esc(a["summary"])}</p><a class="story-link" href="stories/{a["id"]}.html">이야기 읽기 <span aria-hidden="true">↗</span></a></div>{art(a)}</section>'
    rows = []
    for n, (a, day) in enumerate(items):
        search_text = ' '.join(p for section in a['sections'] for p in section['paragraphs'])
        rows.append(f'<article class="story-row" data-story-search="{esc(search_text)}"><span class="story-row-num">{len(items)-n:02d}</span><div>{meta(a, day)}<h3><a href="stories/{a["id"]}.html">{esc(a["title"])}</a></h3><p>{esc(a["summary"])}</p></div><span class="story-row-arrow" aria-hidden="true">↗</span></article>')
    archive = f'<section class="stories-archive" aria-labelledby="archiveTitle"><div class="stories-section-head"><h2 id="archiveTitle">차곡차곡 쌓이는 이야기</h2><span class="stories-count" id="storyCount" role="status">{len(items)}편</span></div><label class="story-search" hidden>이야기 찾기<input id="storySearch" type="search" placeholder="제목·주제·내용으로 찾아보세요" maxlength="100"></label>{"".join(rows)}<p class="editor-note" id="storyEmpty" hidden>찾는 이야기가 없어요. 다른 단어로 검색해보세요.</p></section>'
    note = '<p class="editor-note">이야기마다 출처와 자료 확인 날짜를 함께 전합니다. 오류 제보는 <a href="lounge.html#ask">질문 게시판</a>에서 받아요. 새로운 글은 검토를 거쳐 한 편씩 전합니다.</p>'
    return shell('우주 이야기 — ORBIT 에디터', '달과 행성, 별과 우주, 우주 탐사의 궁금증을 공식 자료와 함께 쉽게 풀어주는 ORBIT 에디터의 우주 이야기.', 'stories.html', head + feature + archive + note)


def render_article(a, day):
    ident = a['id']
    body = f'<article class="story-article"><a class="story-breadcrumb" href="../stories.html">← 우주 이야기 전체보기</a><header>{meta(a, day)}<h1>{esc(a["title"])}</h1><p class="story-standfirst">{esc(a["summary"])}</p><div class="story-byline">{byline(disclose=True)}</div></header><div class="story-body">'
    for section in a['sections']:
        refs = ' '.join(f'<a href="#source-{n}" aria-label="출처 {n} 보기">[{n}]</a>' for n in section['sources'])
        paragraphs = ''
        for i, p in enumerate(section['paragraphs']):
            cite = f'<span class="story-cites">{refs}</span>' if i == len(section['paragraphs']) - 1 else ''
            paragraphs += f'<p>{esc(p)}{cite}</p>'
        body += f'<section><h2>{esc(section["heading"])}</h2>{paragraphs}</section>'
    related = a['related']
    body += f'</div><aside class="story-takeaway"><strong>오늘 기억할 한 가지</strong><p>{esc(a["takeaway"])}</p></aside><aside class="story-next"><strong>읽고 나서, 하늘로</strong><p>{esc(related["description"])}</p><a class="story-link" href="../{esc(related["href"])}">{esc(related["label"])} →</a></aside>'
    body += '<section class="story-sources" aria-labelledby="sourcesTitle"><h2 id="sourcesTitle">이 이야기를 확인한 자료</h2><ol>'
    for n, source in enumerate(a['sources'], 1):
        body += f'<li id="source-{n}"><a href="{esc(source["url"])}" target="_blank" rel="noopener noreferrer">{esc(source["title"])} ↗</a><span>자료 확인 {source["checkedAt"].replace("-", ".")} · 원문 새 탭</span></li>'
    body += '</ol><p class="editor-note">자료의 날짜와 적용 범위를 함께 확인해주세요. <a href="../lounge.html#ask">오류 제보하기 →</a></p></section><div class="story-share"><button class="story-button" id="shareStory" type="button" hidden>이야기 주소 복사</button><a class="story-link" href="../stories.html">다른 이야기 보기 →</a></div><p class="story-status" id="shareStatus" role="status"></p><input class="story-share-fallback" id="shareFallback" aria-label="공유할 이야기 주소" readonly hidden></article>'
    schema = {'@context': 'https://schema.org', '@type': 'Article', 'headline': a['title'], 'description': a['summary'],
              'datePublished': day, 'inLanguage': 'ko', 'url': f'https://orbithere.com/stories/{ident}.html',
              'author': {'@type': 'Organization', 'name': 'ORBIT 에디터', 'description': 'AI가 쓰는 우주 이야기'},
              'publisher': {'@type': 'Organization', 'name': 'Orbit', 'url': 'https://orbithere.com/'},
              'citation': [s['url'] for s in a['sources']]}
    return shell(a['title'], a['summary'], f'stories/{ident}.html', body, '../', schema)


def render_teaser(items, carousel=False):
    if not items:
        return '<aside class="story-teaser"><a class="story-teaser-title" href="stories.html">ORBIT 에디터의 우주 이야기 →</a></aside>'
    a, day = items[0]
    if not carousel:
        return f'<aside class="story-teaser" aria-label="최신 우주 이야기"><span class="story-teaser-icon" aria-hidden="true">{editor_star(21)}</span><div class="story-teaser-copy"><div class="story-teaser-meta"><span>ORBIT 에디터</span></div><a class="story-teaser-title" href="stories/{a["id"]}.html">{esc(a["title"])}</a></div><a class="story-teaser-all" href="stories.html">전체보기 →</a></aside>'
    cards = []
    # Start with the first published story in the center; append every new release.
    for article, _ in reversed(items):
        cards.append(f'<a class="story-belt-card" href="stories/{article["id"]}.html"><span class="story-belt-card-head"><span class="story-teaser-icon" aria-hidden="true">{editor_star(21)}</span><span><span class="story-teaser-meta">ORBIT 에디터</span><span class="story-teaser-category">{esc(article["category"])}</span></span></span><span class="story-teaser-title">{esc(article["title"])}</span></a>')
    return f'''<aside class="story-belt" aria-label="우주 이야기">
<div class="story-belt-heading"><span>우주 이야기</span><a class="story-teaser-all" href="stories.html">전체보기 →</a></div>
<div class="story-belt-viewport"><div class="story-belt-track"><div class="story-belt-group" data-story-original>{''.join(cards)}</div></div></div>
</aside>'''



def outputs(articles, ledger, root=ROOT):
    items = [(articles[item['id']], item['date']) for item in sorted(reversed(ledger['items']), key=lambda i: i['date'], reverse=True)]
    result = {'stories.html': render_list(items)}
    result.update({f'stories/{a["id"]}.html': render_article(a, day) for a, day in items})
    for filename in ('index.html', 'main.html'):
        src = (root / filename).read_text()
        pattern = r'<!-- orbit-story-teaser:start -->.*?<!-- orbit-story-teaser:end -->'
        if len(re.findall(pattern, src, re.S)) != 1:
            raise ValueError(f'{filename}: expected one story teaser marker')
        result[filename] = re.sub(pattern, lambda _: '<!-- orbit-story-teaser:start -->\n' + render_teaser(items, carousel=filename == 'index.html') + '\n<!-- orbit-story-teaser:end -->', src, flags=re.S)
    sitemap = (root / 'sitemap.xml').read_text()
    sitemap = re.sub(r'\s*<url>\s*<loc>https://orbithere\.com/(?:notes\.html|stories\.html|stories/[^<]+)</loc>.*?</url>', '', sitemap, flags=re.S)
    entries = ['  <url><loc>https://orbithere.com/stories.html</loc></url>']
    entries += [f'  <url><loc>https://orbithere.com/stories/{a["id"]}.html</loc><lastmod>{day}</lastmod></url>' for a, day in items]
    result['sitemap.xml'] = sitemap.replace('</urlset>', '\n'.join(entries) + '\n</urlset>')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate and check committed pages, without publishing')
    parser.add_argument('--publish-next', action='store_true', help='Publish one approved, due article if none published today')
    parser.add_argument('--date', help='KST day override for reproducible tests')
    parser.add_argument('--accept-correction', metavar='ID', help='Record an explicitly reviewed correction to a published article')
    args = parser.parse_args()
    if args.check and (args.publish_next or args.accept_correction):
        parser.error('--check is read-only')
    if args.accept_correction:
        ident = args.accept_correction
        if not re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*', ident):
            parser.error('Invalid correction ID')
        ledger = json.loads((ROOT / LEDGER).read_text())
        a = validate_article(json.loads((ROOT / ARTICLE_DIR / f'{ident}.json').read_text()))
        item = next((i for i in ledger['items'] if i['id'] == ident), None)
        if item is None:
            parser.error('Only published articles require a correction record')
        item['contentHash'] = content_hash(a)
        item['correctedAt'] = datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
        (ROOT / LEDGER).write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')
    articles, ledger = load()
    published = None
    if args.publish_next:
        today = args.date or datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
        published = publish_next(articles, ledger, today)
    rendered = outputs(articles, ledger)
    drift = []
    for path, content in rendered.items():
        destination = ROOT / path
        if not destination.exists() or destination.read_text() != content:
            drift.append(path)
    stray = [p for p in (ROOT / 'stories').glob('*.html') if str(p.relative_to(ROOT)) not in rendered]
    if stray:
        raise ValueError('Unexpected/unpublished HTML in stories/: ' + ', '.join(p.name for p in stray))
    if args.check and drift:
        raise ValueError('Run python3 scripts/stories.py to render: ' + ', '.join(drift))
    if not args.check:
        for path, content in rendered.items():
            destination = ROOT / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content)
        if published:
            (ROOT / LEDGER).write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')
    print(f'Stories: {len(articles)} approved files; {len(ledger["items"])} published. ' + (f'Published {published}.' if published else 'No new publication.'))


if __name__ == '__main__':
    try:
        main()
    except (KeyError, TypeError, ValueError, OSError) as error:
        print(f'Stories failed: {error}', file=sys.stderr)
        sys.exit(1)

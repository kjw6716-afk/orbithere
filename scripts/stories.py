#!/usr/bin/env python3
"""Validate approved editorial files, publish due articles, and render static pages.

AI drafts arrive in pull requests. Merging an article file is the editorial approval.
This renderer never calls a model or treats a successful syntax check as fact checking.
"""
import argparse
from datetime import date, datetime
from email.utils import format_datetime
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
IMAGE_MANIFEST = 'data/story-images.json'
CATEGORIES = ('달과 행성', '별과 우주', '우주 탐사', '관측 이야기')
SOURCE_DOMAINS = ('nasa.gov', 'esa.int', 'kasi.re.kr', 'imo.net', 'noaa.gov',
                  'spacex.com', 'rocketlabusa.com', 'blueorigin.com', 'fireflyspace.com')
RELATED = {'sky.html', 'planets.html', 'guide.html', 'reading-sky.html', 'news.html', 'lounge.html'}


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
    seen = set()
    for item in ledger['items']:
        ident, day = item['id'], valid_date(item['date'])
        if ident not in articles or ident in seen:
            raise ValueError('Missing article or duplicate article')
        if articles[ident]['publishAfter'] > day:
            raise ValueError('Article published before its allowed date')
        if item['contentHash'] != content_hash(articles[ident]):
            raise ValueError('Published article changed: use --accept-correction ID after source review')
        seen.add(ident)
    return articles, ledger


def publish_next(articles, ledger, today):
    valid_date(today)
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


def publish_due(articles, ledger, today):
    published = []
    while (ident := publish_next(articles, ledger, today)) is not None:
        published.append(ident)
    return published


def esc(value):
    return escape(str(value), quote=True)


def webp_size(path):
    """Check the WebP container and frame dimensions without a decoder dependency.

    Browser image decoding and editorial visual review remain separate checks.
    """
    data = path.read_bytes()
    if (len(data) < 20 or data[:4] != b'RIFF' or data[8:12] != b'WEBP'
            or int.from_bytes(data[4:8], 'little') + 8 != len(data)):
        raise ValueError(f'Invalid WebP cover: {path.name}')
    offset, frame, canvas = 12, None, None
    while offset + 8 <= len(data):
        kind = data[offset:offset + 4]
        length = int.from_bytes(data[offset + 4:offset + 8], 'little')
        end = offset + 8 + length
        chunk = data[offset + 8:end]
        if end + (length % 2) > len(data):
            raise ValueError(f'Truncated WebP cover: {path.name}')
        if kind == b'VP8X':
            if length != 10 or chunk[0] & 2:
                raise ValueError(f'Invalid or animated WebP cover: {path.name}')
            canvas = (int.from_bytes(chunk[4:7], 'little') + 1,
                      int.from_bytes(chunk[7:10], 'little') + 1)
        elif kind in (b'VP8 ', b'VP8L'):
            if frame is not None:
                raise ValueError(f'Multiple frames in WebP cover: {path.name}')
            if kind == b'VP8 ' and length >= 10 and chunk[3:6] == b'\x9d\x01\x2a':
                frame = (int.from_bytes(chunk[6:8], 'little') & 0x3fff,
                         int.from_bytes(chunk[8:10], 'little') & 0x3fff)
            elif kind == b'VP8L' and length >= 5 and chunk[0] == 0x2f:
                bits = int.from_bytes(chunk[1:5], 'little')
                frame = ((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1)
            else:
                raise ValueError(f'Invalid WebP frame: {path.name}')
        elif kind in (b'ANIM', b'ANMF'):
            raise ValueError(f'Animated WebP cover: {path.name}')
        offset = end + (length % 2)
    if offset != len(data) or frame is None or (canvas is not None and canvas != frame):
        raise ValueError(f'Invalid WebP cover: {path.name}')
    return frame


def load_images(root=ROOT):
    """Keep artwork separate from approved article content and publication hashes."""
    images = json.loads((root / IMAGE_MANIFEST).read_text(encoding='utf-8'))
    if (not isinstance(images, dict) or images.get('version') != 1
            or not all(isinstance(images.get(field), dict) for field in ('images', 'articles', 'categories'))):
        raise ValueError('Invalid story image manifest')
    text(images['notice'], 10, 180)
    for key, image in images['images'].items():
        if not re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*', key):
            raise ValueError('Invalid story image key')
        if not isinstance(image, dict):
            raise ValueError('Invalid story cover metadata')
        text(image['alt'], 10, 160)
        if 'generation' in image:
            generation = image['generation']
            if not isinstance(generation, dict) or generation.get('tool') != 'image_gen':
                raise ValueError('Story cover generation must record image_gen')
            valid_date(generation['generatedAt'])
            text(generation['prompt'], 50, 6000)
        for width in (640, 1200):
            path = root / f'images/stories/{key}-{width}.webp'
            if not path.is_file():
                raise ValueError(f'Missing story cover: {path.relative_to(root)}')
            if webp_size(path) != (width, width * 9 // 16):
                raise ValueError(f'Story cover must be {width}×{width * 9 // 16}: {path.name}')
    categories = images['categories']
    if set(categories) != set(CATEGORIES):
        raise ValueError('Every story category needs a cover fallback')
    for key in [*categories.values(), *images['articles'].values()]:
        if not isinstance(key, str) or key not in images['images']:
            raise ValueError('Unknown story cover mapping')
    return images


def image_key(article, images):
    return images['articles'].get(article['id'], images['categories'][article['category']])


def validate_draft_covers(articles, ledger, images, root=ROOT):
    """A new story needs its own generated cover before any publication writes.

    Already published stories retain their existing shared or category covers.
    """
    published = {item['id'] for item in ledger['items']}
    used = {}
    for article in articles.values():
        used.setdefault(image_key(article, images), []).append(article['id'])
    fingerprints = {}
    for key in images['images']:
        for width in (640, 1200):
            path = root / f'images/stories/{key}-{width}.webp'
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            fingerprints.setdefault((width, digest), []).append(key)
    for ident in sorted(set(articles) - published):
        key = images['articles'].get(ident)
        if key is None:
            raise ValueError(f'Unpublished story needs an explicit generated cover: {ident}')
        if key in images['categories'].values() or len(used[key]) != 1:
            raise ValueError(f'Unpublished story needs a unique cover, not a shared/category cover: {ident}')
        if 'generation' not in images['images'][key]:
            raise ValueError(f'Unpublished story cover needs generation metadata: {ident}')
        for width in (640, 1200):
            path = root / f'images/stories/{key}-{width}.webp'
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if len(fingerprints[(width, digest)]) > 1:
                raise ValueError(f'Unpublished story cover reuses an existing image file: {ident}')


def render_cover(article, images, prefix='', featured=False, split=False):
    key = image_key(article, images)
    src = f'{prefix}images/stories/{key}'
    sizes = ('(max-width: 860px) calc(100vw - 36px), (max-width: 1680px) calc(100vw - 308px), 1372px'
             if featured else '(max-width: 600px) calc(100vw - 36px), (max-width: 860px) calc((100vw - 60px) / 2), (max-width: 1680px) calc((100vw - 332px) / 2), 674px')
    if split:
        sizes = '(max-width: 860px) calc(100vw - 36px), (max-width: 1199px) calc(100vw - 308px), (max-width: 1680px) calc((100vw - 308px) * .62), 851px'
    loading = 'loading="eager" fetchpriority="high"' if featured else 'loading="lazy"'
    return (f'<img class="story-cover" src="{src}-{1200 if featured else 640}.webp" '
            f'srcset="{src}-640.webp 640w, {src}-1200.webp 1200w" sizes="{sizes}" '
            f'width="1200" height="675" alt="{esc(images["images"][key]["alt"])}" '
            f'{loading} decoding="async">')


def rss_date(day):
    published = date.fromisoformat(day)
    return format_datetime(datetime(published.year, published.month, published.day,
                                    tzinfo=ZoneInfo('Asia/Seoul')))


def render_rss_body(article):
    body = [f'<p>{esc(article["summary"])}</p>']
    for section in article['sections']:
        body.append(f'<h2>{esc(section["heading"])}</h2>')
        body.extend(f'<p>{esc(paragraph)}</p>' for paragraph in section['paragraphs'])
    body.append(f'<h2>오늘 기억할 한 가지</h2><p>{esc(article["takeaway"])}</p>')
    body.append('<h2>이 이야기를 확인한 자료</h2><ol>')
    body.extend(f'<li>{esc(source["title"])} · 자료 확인 {esc(source["checkedAt"])}</li>'
                for source in article['sources'])
    body.append('</ol>')
    return ''.join(body)


def render_rss(items):
    # RSS announces recent releases; the sitemap remains the complete URL inventory.
    items = items[:20]
    channel = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0">',
        '<channel>',
        '<title>ORBIT 우주 이야기</title>',
        '<link>https://orbithere.com/stories.html</link>',
        '<description>달과 행성, 별과 우주, 우주 탐사의 궁금증을 공식 자료와 함께 쉽게 풀어주는 이야기입니다.</description>',
        '<language>ko-KR</language>',
    ]
    if items:
        channel.append(f'<lastBuildDate>{rss_date(items[0][1])}</lastBuildDate>')
    for article, day in items:
        url = f'https://orbithere.com/stories/{article["id"]}.html'
        channel.extend([
            '<item>',
            f'<title>{esc(article["title"])}</title>',
            f'<link>{url}</link>',
            f'<guid isPermaLink="true">{url}</guid>',
            f'<pubDate>{rss_date(day)}</pubDate>',
            f'<category>{esc(article["category"])}</category>',
            f'<description>{esc(render_rss_body(article))}</description>',
            '</item>',
        ])
    channel.extend(['</channel>', '</rss>'])
    return '\n'.join(channel) + '\n'


def json_script(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def shell(title, description, path, body, prefix='', schema=None, noindex=False, script='stories.js', share_image=None):
    canonical = 'https://orbithere.com/' + path
    image_url = share_image['url'] if share_image else 'https://orbithere.com/images/og.png'
    image_meta = ''
    if share_image:
        image_meta = (f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="675">'
                      f'<meta property="og:image:type" content="image/webp"><meta property="og:image:alt" content="{esc(share_image["alt"])}">'
                      f'<meta name="twitter:image:alt" content="{esc(share_image["alt"])}">')
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
<link rel="alternate" type="application/rss+xml" title="ORBIT 우주 이야기 RSS" href="https://orbithere.com/rss.xml">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="{'article' if schema else 'website'}"><meta property="og:site_name" content="Orbit">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{canonical}"><meta property="og:image" content="{esc(image_url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}"><meta name="twitter:description" content="{esc(description)}">
<meta name="twitter:image" content="{esc(image_url)}">{image_meta}
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
<link rel="stylesheet" href="{prefix}orbit.css?v=20260912-brand">
<link rel="stylesheet" href="{prefix}site-nav.css?v=20260926-mint">
<link rel="stylesheet" href="{prefix}stories.css?v=20260927-reading-flow">
{f'<script type="application/ld+json">{json_script(schema)}</script>' if schema else ''}
<script src="{prefix}site-nav.js?v=20260914-community" defer></script>
<script src="{prefix}{script}?v=20260927-reading-flow" defer></script>
<script src="{prefix}orbit-config.js"></script>{'' if noindex else f'<script src="{prefix}orbit-analytics.js?v=20260927-funnel" defer></script>'}<script src="{prefix}visits.js" defer></script>
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


def render_list(items, images=None):
    images = images if images is not None else load_images()
    head = '<header class="stories-heading"><div><p class="story-eyebrow">ORBIT STORIES</p><h1><a class="page-title-link" href="stories.html">우주를 조금 더 가까이.</a></h1><p class="stories-deck">궁금한 질문 하나에서 시작하는 우주 이야기.<br>어려운 말은 풀어서, 믿을 만한 자료와 함께 전해요.</p></div>' + byline() + '</header>'
    feature = '<p class="editor-note">첫 번째 이야기를 준비하고 있어요. <a href="news.html">우주 뉴스 둘러보기 →</a></p>'
    if items:
        a, day = items[0]
        search_text = ' '.join(p for section in a['sections'] for p in section['paragraphs'])
        feature = f'<article class="story-feature" data-story-search="{esc(search_text)}" data-story-category="{esc(a["category"])}" aria-labelledby="latestStoryTitle"><a class="story-cover-link" href="stories/{a["id"]}.html" aria-hidden="true" tabindex="-1">{render_cover(a, images, featured=True, split=True)}</a><div class="story-feature-copy"><p class="story-eyebrow">가장 최근의 이야기</p>{meta(a, day)}<h2 id="latestStoryTitle"><a href="stories/{a["id"]}.html">{esc(a["title"])}</a></h2><p>{esc(a["summary"])}</p><a class="story-link" href="stories/{a["id"]}.html">이야기 읽기 <span aria-hidden="true">↗</span></a></div></article>'
    rows = []
    for a, day in items[1:]:
        search_text = ' '.join(p for section in a['sections'] for p in section['paragraphs'])
        rows.append(f'<article class="story-row story-card" data-story-search="{esc(search_text)}" data-story-category="{esc(a["category"])}"><a class="story-cover-link" href="stories/{a["id"]}.html" aria-hidden="true" tabindex="-1">{render_cover(a, images)}</a><div class="story-card-copy">{meta(a, day)}<h3><a href="stories/{a["id"]}.html">{esc(a["title"])}</a></h3><p>{esc(a["summary"])}</p><a class="story-card-read" href="stories/{a["id"]}.html" aria-label="{esc(a["title"])} 읽기">이야기 읽기 <span aria-hidden="true">↗</span></a></div></article>')
    filters = '<div class="story-filters" role="group" aria-label="이야기 주제" hidden>'
    for category in ('', *CATEGORIES):
        filters += f'<button class="story-filter" type="button" data-story-category="{esc(category)}" aria-pressed="{"false" if category else "true"}" aria-controls="storyResults">{esc(category or "전체")}</button>'
    filters += '</div>'
    archive = f'<section class="stories-archive" aria-labelledby="archiveTitle"><div class="stories-section-head"><h2 id="archiveTitle">차곡차곡 쌓이는 이야기</h2><span class="stories-count" id="storyCount" role="status" aria-live="polite" aria-atomic="true">전체 · {len(items)}편</span></div><label class="story-search" hidden>이야기 찾기<input id="storySearch" type="search" placeholder="제목·주제·내용으로 찾아보세요" maxlength="100" aria-controls="storyResults"></label>{filters}<div id="storyResults">{feature}<div class="story-grid">{"".join(rows)}</div></div><div class="story-empty" id="storyEmpty" hidden><p id="storyEmptyMessage">찾는 이야기가 없어요. 검색어를 바꾸거나 다른 주제를 골라보세요.</p><button class="story-button" id="storyReset" type="button">검색과 분류 초기화</button></div></section>'
    note = f'<p class="story-image-note">{esc(images["notice"])}</p><p class="editor-note">이야기마다 출처와 자료 확인 날짜를 함께 전합니다. 오류 제보는 <a href="lounge.html#ask">질문 게시판</a>에서 받아요. 새로운 글은 검토를 거쳐 전합니다.</p>'
    return shell('우주 이야기 — ORBIT 에디터', '달과 행성, 별과 우주, 우주 탐사의 궁금증을 공식 자료와 함께 쉽게 풀어주는 ORBIT 에디터의 우주 이야기.', 'stories.html', head + archive + note)


def related_stories(article, published_items):
    """Rank only the public collection; ties retain newest publication order.

    Category comes first, then shared primary sources and the observing tool.
    These existing fields avoid editing (and re-hashing) approved manuscripts.
    """
    sources = {source['url'] for source in article['sources']}
    seen_ids, seen_titles = {article['id']}, {article['title']}
    candidates = []
    for candidate, day in published_items:
        if candidate['id'] in seen_ids or candidate['title'] in seen_titles:
            continue
        seen_ids.add(candidate['id'])
        seen_titles.add(candidate['title'])
        shared_sources = len(sources & {source['url'] for source in candidate['sources']})
        rank = (candidate['category'] == article['category'], shared_sources,
                candidate['related']['href'] == article['related']['href'])
        candidates.append((rank, candidate, day))
    candidates.sort(key=lambda item: item[0], reverse=True)
    return [(candidate, day) for _, candidate, day in candidates[:3]]


def render_related(article, published_items, images):
    cards = []
    for candidate, _ in related_stories(article, published_items):
        title_id = 'related-story-' + candidate['id']
        cards.append(f'<a class="story-related-card" href="{candidate["id"]}.html" aria-labelledby="{title_id}">{render_cover(candidate, images, "../")}<div class="story-related-copy"><span class="story-tag">{esc(candidate["category"])}</span><h3 id="{title_id}">{esc(candidate["title"])}</h3><p>{esc(candidate["summary"])}</p><span class="story-card-read" aria-hidden="true">이야기 읽기 ↗</span></div></a>')
    if not cards:
        return ''
    return '<section class="story-related" aria-labelledby="relatedStoriesTitle"><div class="story-related-heading"><h2 id="relatedStoriesTitle">함께 읽으면 좋은 이야기</h2><p>이어지는 궁금증도 천천히 살펴보세요.</p></div><div class="story-related-grid">' + ''.join(cards) + '</div></section>'


def render_article(a, day, images=None, published_items=()):
    images = images if images is not None else load_images()
    ident = a['id']
    body = f'<article class="story-article"><a class="story-breadcrumb" href="../stories.html">← 우주 이야기 전체보기</a><header>{meta(a, day)}<h1>{esc(a["title"])}</h1><p class="story-standfirst">{esc(a["summary"])}</p><div class="story-byline">{byline(disclose=True)}</div></header><figure class="story-article-cover">{render_cover(a, images, "../", featured=True)}<figcaption class="story-image-note">{esc(images["notice"])}</figcaption></figure><div class="story-body">'
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
    body += '</ol><p class="editor-note">자료의 날짜와 적용 범위를 함께 확인해주세요. <a href="../lounge.html#ask">오류 제보하기 →</a></p></section>'
    body += render_related(a, published_items, images)
    body += '<div class="story-share"><button class="story-button" id="shareStory" type="button" hidden>이야기 주소 복사</button><a class="story-link" href="../stories.html">다른 이야기 보기 →</a></div><p class="story-status" id="shareStatus" role="status"></p><input class="story-share-fallback" id="shareFallback" aria-label="공유할 이야기 주소" readonly hidden></article>'
    key = image_key(a, images)
    share_image = {'url': f'https://orbithere.com/images/stories/{key}-1200.webp',
                   'alt': images['images'][key]['alt']}
    schema = {'@context': 'https://schema.org', '@type': 'Article', 'headline': a['title'], 'description': a['summary'],
              'datePublished': day, 'inLanguage': 'ko', 'url': f'https://orbithere.com/stories/{ident}.html',
              'image': share_image['url'],
              'author': {'@type': 'Organization', 'name': 'ORBIT 에디터', 'description': 'AI가 쓰는 우주 이야기'},
              'publisher': {'@type': 'Organization', 'name': 'Orbit', 'url': 'https://orbithere.com/'},
              'citation': [s['url'] for s in a['sources']]}
    return shell(a['title'], a['summary'], f'stories/{ident}.html', body, '../', schema, share_image=share_image)


def render_teaser(items, carousel=False):
    if not items:
        return '<aside class="story-teaser"><a class="story-teaser-title" href="stories.html">ORBIT 에디터의 우주 이야기 →</a></aside>'
    a, day = items[0]
    if not carousel:
        return f'<aside class="story-teaser" aria-label="최신 우주 이야기"><span class="story-teaser-icon" aria-hidden="true">{editor_star(21)}</span><div class="story-teaser-copy"><div class="story-teaser-meta"><span>ORBIT 에디터</span></div><a class="story-teaser-title" href="stories/{a["id"]}.html">{esc(a["title"])}</a></div><a class="story-teaser-all" href="stories.html">전체보기 →</a></aside>'
    cards = []
    # Start with the first published story in the center; append every new release.
    for article, _ in reversed(items):
        cards.append(f'<a class="story-belt-card" href="stories/{article["id"]}.html"><span class="story-belt-card-head"><span class="story-teaser-meta">ORBIT 에디터<span class="story-editor-star" aria-hidden="true">{editor_star(10)}</span></span><span class="story-teaser-category">{esc(article["category"])}</span></span><span class="story-teaser-title">{esc(article["title"])}</span></a>')
    return f'''<aside class="story-belt" aria-label="우주 이야기">
<div class="story-belt-heading"><a class="story-teaser-all" href="stories.html">전체보기 →</a></div>
<div class="story-belt-viewport"><div class="story-belt-track"><div class="story-belt-group" data-story-original>{''.join(cards)}</div></div></div>
</aside>'''



def outputs(articles, ledger, root=ROOT):
    images = load_images(root)
    items = [(articles[item['id']], item['date']) for item in sorted(reversed(ledger['items']), key=lambda i: i['date'], reverse=True)]
    result = {'stories.html': render_list(items, images), 'rss.xml': render_rss(items)}
    result.update({f'stories/{a["id"]}.html': render_article(a, day, images, items) for a, day in items})
    for filename in ('main.html',):
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
    publication = parser.add_mutually_exclusive_group()
    publication.add_argument('--publish-next', action='store_true', help='Publish the next approved, due article')
    publication.add_argument('--publish-due', action='store_true', help='Publish all approved, due articles without a daily limit')
    parser.add_argument('--date', help='KST day override for reproducible tests')
    parser.add_argument('--accept-correction', metavar='ID', help='Record an explicitly reviewed correction to a published article')
    args = parser.parse_args()
    if args.check and (args.publish_next or args.publish_due or args.accept_correction):
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
    images = load_images()
    validate_draft_covers(articles, ledger, images)
    published = []
    if args.publish_next or args.publish_due:
        today = args.date or datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
        if args.publish_due:
            published = publish_due(articles, ledger, today)
        else:
            ident = publish_next(articles, ledger, today)
            if ident is not None:
                published.append(ident)
    rendered = outputs(articles, ledger)
    drift = []
    for path, content in rendered.items():
        destination = ROOT / path
        if not destination.exists() or destination.read_text() != content:
            drift.append(path)
    stray = [p for p in (ROOT / 'stories').glob('*.html') if p.relative_to(ROOT).as_posix() not in rendered]
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
    print(f'Stories: {len(articles)} approved files; {len(ledger["items"])} published. ' +
          ('Published ' + ', '.join(published) + '.' if published else 'No new publication.'))


if __name__ == '__main__':
    try:
        main()
    except (KeyError, TypeError, ValueError, OSError) as error:
        print(f'Stories failed: {error}', file=sys.stderr)
        sys.exit(1)

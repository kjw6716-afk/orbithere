#!/usr/bin/env python3
"""Fetch official RSS and public news-index metadata. Never copy article bodies."""
import argparse
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import subprocess
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

SOURCES = [
    {'id': 'kasi', 'name': '한국천문연구원', 'language': 'ko', 'host': 'www.kasi.re.kr', 'feed': 'https://www.kasi.re.kr/rss/newsMaterial', 'home': 'https://www.kasi.re.kr/kor/publication/post/newsMaterial'},
    {'id': 'nasa', 'name': 'NASA / JPL', 'language': 'en', 'host': 'www.nasa.gov', 'feed': 'https://www.nasa.gov/centers-and-facilities/jpl/feed/', 'home': 'https://www.nasa.gov/centers-and-facilities/jpl/'},
    {'id': 'esa', 'name': 'ESA 우주과학', 'language': 'en', 'host': 'www.esa.int', 'feed': 'https://www.esa.int/rssfeed/Our_Activities/Space_Science', 'home': 'https://www.esa.int/Science_Exploration/Space_Science'},
    {'id': 'spacex', 'name': 'SpaceX', 'language': 'en', 'host': 'www.spacex.com', 'kind': 'browser', 'feed': 'https://www.spacex.com/updates', 'home': 'https://www.spacex.com/updates', 'fragments': True},
    {'id': 'starlink', 'name': 'Starlink · SpaceX', 'language': 'ko', 'host': 'starlink.com', 'kind': 'browser', 'feed': 'https://starlink.com/kr/updates', 'home': 'https://starlink.com/kr/updates'},
    {'id': 'rocketlab', 'name': 'Rocket Lab', 'language': 'en', 'host': 'rocketlabcorp.com', 'kind': 'browser', 'feed': 'https://rocketlabcorp.com/updates/', 'home': 'https://rocketlabcorp.com/updates/'},
    {'id': 'ast', 'name': 'AST SpaceMobile', 'language': 'en', 'host': 'feeds.issuerdirect.com', 'kind': 'json', 'feed': 'https://investors.ast-science.com/press-releases', 'home': 'https://investors.ast-science.com/press-releases'},
    {'id': 'firefly', 'name': 'Firefly Aerospace', 'language': 'en', 'host': 'fireflyspace.com', 'kind': 'browser', 'feed': 'https://fireflyspace.com/news/', 'home': 'https://fireflyspace.com/news/'},
]
# Preserve previously checked summaries when a rolling collection source retires.
ARCHIVED_SOURCES = [
    {'id': 'blueorigin', 'host': 'www.blueorigin.com'},
]
UTC = dt.timezone.utc
MAX_BYTES = 2 * 1024 * 1024
TRANSLATION_FIELDS = ('titleKo', 'titleKoOriginal', 'titleKoMethod', 'titleKoModel')
DRAFT_FIELDS = ('titleKoDraft', 'titleKoDraftOriginal', 'titleKoDraftModel')

def valid_translation(item):
    title = item.get('titleKo')
    return (item.get('language') == 'en' and isinstance(title, str)
            and 1 <= len(title) <= 240 and bool(re.search('[가-힣]', title))
            and not re.search(r'[<>\x00-\x1f]', title)
            and item.get('titleKoOriginal') == item.get('title')
            and item.get('titleKoMethod') == 'reviewed')

def valid_draft(item):
    return valid_translation(dict(item, titleKo=item.get('titleKoDraft'),
                                  titleKoOriginal=item.get('titleKoDraftOriginal'),
                                  titleKoMethod='reviewed'))

def preserve_translations(fresh, previous):
    cached = {item.get('url'): item for item in previous.get('items', [])}
    for item in fresh:
        old = cached.get(item.get('url'), {})
        if old.get('source') == item.get('source') and old.get('title') == item.get('title'):
            if valid_translation(old):
                item.update({key: old[key] for key in TRANSLATION_FIELDS if key in old})
            if valid_draft(old):
                item.update({key: old[key] for key in DRAFT_FIELDS if key in old})
    return fresh

def safe_url(raw, source):
    try:
        url = urllib.parse.urlsplit(html.unescape(raw.strip()))
        # Feeds sometimes retain http links; always upgrade on these HTTPS sites.
        if url.scheme not in ('https', 'http') or url.hostname != source['host'] or url.username or url.password or url.port not in (None, 80, 443):
            return None
        if source['id'] == 'ast':
            query = urllib.parse.parse_qs(url.query, keep_blank_values=True)
            if (url.path != '/news-release.html' or query.get('symbol') != ['ASTS']
                    or set(query) != {'newsid', 'symbol'} or len(query['newsid']) != 1
                    or not re.fullmatch(r'[0-9]+', query['newsid'][0])):
                return None
        return urllib.parse.urlunsplit(('https', source['host'], url.path, url.query, url.fragment if source.get('fragments') else ''))
    except ValueError:
        return None

def published(raw):
    try:
        date = email.utils.parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        try:
            date = dt.datetime.fromisoformat(raw.replace('Z', '+00:00'))
        except (TypeError, ValueError, AttributeError):
            date = None
            for pattern in ('%B %d, %Y', '%b %d, %Y'):
                try:
                    date = dt.datetime.strptime(raw, pattern)
                    break
                except (TypeError, ValueError):
                    pass
            if date is None:
                return None
    if date.tzinfo is None:
        date = date.replace(tzinfo=UTC)
    return date.astimezone(UTC)

def parse_feed(body, source, now):
    if len(body) > MAX_BYTES or re.search(br'<!\s*(DOCTYPE|ENTITY)', body, re.I):
        raise ValueError('Feed size or XML declaration rejected')
    root = ET.fromstring(body)
    entries = [el for el in root.iter() if el.tag.split('}')[-1] in ('item', 'entry')]
    if not entries:
        raise ValueError('Feed contains no entries')
    items, seen = [], set()
    for entry in entries[:100]:
        def value(*names):
            for child in entry:
                if child.tag.split('}')[-1] in names:
                    return ''.join(child.itertext()).strip()
            return ''
        link = value('link')
        if not link:
            for child in entry:
                if child.tag.split('}')[-1] == 'link' and child.get('rel', 'alternate') == 'alternate':
                    link = child.get('href', '')
                    break
        link = safe_url(link, source)
        title = re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', '', html.unescape(value('title')))).strip()[:240]
        date = published(value('pubDate', 'published', 'date', 'updated'))
        if not link or not title or not date or date > now + dt.timedelta(days=1) or link in seen:
            continue
        seen.add(link)
        items.append({'id': hashlib.sha256(link.encode()).hexdigest()[:16], 'source': source['id'], 'title': title, 'url': link, 'publishedAt': date.isoformat().replace('+00:00', 'Z'), 'language': source['language']})
    if not items:
        raise ValueError('No valid official headlines')
    return sorted(items, key=lambda item: item['publishedAt'], reverse=True)[:8]

class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, source):
        self.source = source
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not safe_url(newurl, self.source):
            raise ValueError('Non-official feed redirect rejected')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch_source(source, now):
    if source.get('kind') == 'json':
        return fetch_ast_source(source, now)
    request = urllib.request.Request(source['feed'], headers={'User-Agent': 'OrbitNews/1.0 (+https://orbithere.com/news.html)', 'Accept': 'application/rss+xml, application/xml, text/xml'})
    with urllib.request.build_opener(OfficialRedirect(source)).open(request, timeout=20) as response:
        if not safe_url(response.url, source):
            raise ValueError('Unexpected feed destination')
        return parse_feed(response.read(MAX_BYTES + 1), source, now)

def parse_company_rows(rows, source, now):
    if not isinstance(rows, list):
        raise ValueError('Invalid company index')
    result, seen = [], set()
    for row in rows[:100]:
        if not isinstance(row, dict):
            continue
        url = safe_url(str(row.get('url', '')), source)
        date = published(row.get('date', ''))
        title = re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', '', html.unescape(str(row.get('title', ''))))).strip()[:240]
        if not url or not date or not title or date > now + dt.timedelta(days=1) or url in seen:
            continue
        seen.add(url)
        result.append({'id': hashlib.sha256(url.encode()).hexdigest()[:16], 'source': source['id'],
                       'title': title, 'url': url, 'publishedAt': date.isoformat().replace('+00:00', 'Z'),
                       'language': source['language']})
    if not result:
        raise ValueError('No dated official company headlines')
    return sorted(result, key=lambda row: row['publishedAt'], reverse=True)[:8]


def parse_ast_feed(body, source, now):
    if len(body) > MAX_BYTES:
        raise ValueError('AST feed too large')
    payload = json.loads(body)
    # The provider serves either a JSON object or a JSON-encoded object string.
    if isinstance(payload, str):
        payload = json.loads(payload)
    groups = payload.get('results', {}).get('news', [])
    rows = []
    for group in groups[:10]:
        if group.get('topicstring') != 'ASTS':
            continue
        for item in group.get('newsitem', [])[:100]:
            ident = str(item.get('newsid', ''))
            title = item.get('headline', '')
            # The shared provider also returns market commentary about ASTS.
            # Accept AST company releases, not third-party investment headlines.
            if (item.get('qmsource') != 'bwi' or not isinstance(title, str)
                    or not title.startswith('AST SpaceMobile ') or not re.fullmatch(r'[0-9]+', ident)):
                continue
            rows.append({'title': title, 'date': item.get('datetime'),
                         'url': f'https://feeds.issuerdirect.com/news-release.html?newsid={ident}&symbol=ASTS'})
    recent = parse_company_rows(rows, source, now)
    selected = [row for row in recent if not re.search(
        r'\b(?:private|public) offering\b|\bto host\b.*\bcall\b', row['title'], re.I)]
    if not selected:
        raise ValueError('No eligible AST company headlines')
    return selected


def fetch_ast_source(source, now):
    # Public metadata endpoint used by the feed embedded on AST's official IR.
    # Request no bodies or thumbnails; article reading/review is a separate step.
    query = urllib.parse.urlencode({
        'topics': 'ASTS', 'excludeTopics': 'NONCOMPANY', 'noSrc': 'qmr',
        'src': 'bwi', 'summary': 'false', 'thumbnailurl': 'false',
        'start': (now - dt.timedelta(days=365)).strftime('%Y-%m-%d'), 'end': '3000-01-01',
    })
    url = 'https://www.accesswire.com/qm/data/getHeadlines.json?' + query
    transport = {'id': 'ast_feed', 'host': 'www.accesswire.com'}
    request = urllib.request.Request(url, headers={
        'User-Agent': 'OrbitNews/1.0 (+https://orbithere.com/news.html)', 'Accept': 'application/json'})
    with urllib.request.build_opener(OfficialRedirect(transport)).open(request, timeout=20) as response:
        if not safe_url(response.url, transport):
            raise ValueError('Unexpected AST metadata destination')
        return parse_ast_feed(response.read(MAX_BYTES + 1), source, now)

def fetch_company_sources():
    script = Path(__file__).with_name('company_news.mjs')
    response = subprocess.run(['node', str(script)], capture_output=True, text=True, timeout=100, check=True)
    if len(response.stdout) > MAX_BYTES:
        raise ValueError('Company response too large')
    return json.loads(response.stdout)

def collect(previous, fetch=None, now=None):
    now = now or dt.datetime.now(UTC)
    stamp = now.isoformat(timespec='seconds').replace('+00:00', 'Z')
    items, states, successes = [], [], 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        companies = executor.submit(fetch_company_sources) if fetch is None else None
        pending = {s['id']: executor.submit(fetch or fetch_source, s, now)
                   for s in SOURCES if fetch is not None or s.get('kind') != 'browser'}
        for source in SOURCES:
            prior = next((s for s in previous.get('sources', []) if s.get('id') == source['id']), {})
            state = {k: source[k] for k in ('id', 'name', 'language', 'feed', 'home')}
            state['lastCheckedAt'] = stamp
            try:
                if fetch is None and source.get('kind') == 'browser':
                    index = companies.result().get(source['id'], {})
                    if index.get('error'):
                        raise ValueError(index['error'])
                    fresh = parse_company_rows(index.get('rows'), source, now)
                else:
                    fresh = pending[source['id']].result()
                if not fresh:
                    raise ValueError('Empty feed')
                items.extend(preserve_translations(fresh, previous))
                state.update(status='ok', lastSuccessfulAt=stamp)
                successes += 1
            except Exception as error:
                # Error details belong to Actions logs, never feed content or UI.
                print(f"{source['id']}: {type(error).__name__}: {error}", file=sys.stderr)
                items.extend(item for item in previous.get('items', []) if item.get('source') == source['id'] and safe_url(item.get('url', ''), source))
                state.update(status='unavailable', lastSuccessfulAt=prior.get('lastSuccessfulAt'))
            states.append(state)
    return {'version': 1, 'checkedAt': stamp, 'sources': states, 'items': sorted(items, key=lambda item: item['publishedAt'], reverse=True)[:8 * len(SOURCES)]}, successes

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data/news.json')
    args = parser.parse_args()
    previous = json.loads(args.output.read_text()) if args.output.exists() else {}
    result, successes = collect(previous)
    if not result['items']:
        print('No cached or fresh news available; previous file preserved.', file=sys.stderr)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temp.replace(args.output)
    print(f"Saved {len(result['items'])} headlines; {successes}/{len(SOURCES)} sources refreshed.")
    # Still save outage states so the UI does not claim a fresh successful sync.
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

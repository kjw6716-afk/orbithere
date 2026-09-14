#!/usr/bin/env python3
"""Validate source-checked Korean briefs; list uncovered news for editorial work.

This validates structure and article identity, not factual accuracy. Authors must
read each official source before adding a brief. The two-hour headline collector
does not modify this separate file, so refreshes cannot erase checked summaries.
"""
import argparse
from datetime import date
import hashlib
import json
from pathlib import Path
import re

from update_news import SOURCES, ARCHIVED_SOURCES, safe_url, published

ROOT = Path(__file__).resolve().parents[1]


def korean(value, low, high):
    return (isinstance(value, str) and low <= len(value.strip()) <= high
            and bool(re.search('[가-힣]', value))
            and not re.search(r'[<>\x00-\x1f]', value))


def validate(data):
    if not isinstance(data, dict) or data.get('version') != 1:
        raise ValueError('Expected summary schema version 1')
    rows = data.get('items')
    if not isinstance(rows, list) or len(rows) > 256:
        raise ValueError('Expected at most 256 summary entries')
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('Invalid summary entry')
        source = next((s for s in SOURCES + ARCHIVED_SOURCES if s['id'] == row.get('source')), None)
        url = row.get('url')
        if not source or not isinstance(url, str) or safe_url(url, source) != url:
            raise ValueError('Summary must link to its official source')
        ident = hashlib.sha256(url.encode()).hexdigest()[:16]
        if row.get('id') != ident or ident in seen:
            raise ValueError('Duplicate or mismatched article ID')
        seen.add(ident)
        original = row.get('titleOriginal')
        if not isinstance(original, str) or not 1 <= len(original) <= 240:
            raise ValueError('Missing original headline')
        if not published(row.get('publishedAt', '')) or row.get('method') != 'source-checked':
            raise ValueError('Missing publication or source check')
        if not korean(row.get('titleKo'), 1, 240):
            raise ValueError('Invalid Korean headline')
        sentences = row.get('summaryKo')
        if not isinstance(sentences, list) or not 2 <= len(sentences) <= 3:
            raise ValueError('A summary needs two or three sentences')
        if not all(korean(s, 10, 240) for s in sentences):
            raise ValueError('Invalid summary text')
        checked = row.get('checkedAt')
        if not isinstance(checked, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', checked):
            raise ValueError('Missing source check date')
        date.fromisoformat(checked)
    return rows


def matching(item, row):
    return all(item.get(k) == row.get(k) for k in ('id', 'source', 'url', 'publishedAt')) and item.get('title') == row.get('titleOriginal')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--summaries', type=Path, default=ROOT / 'data/news-summaries.json')
    parser.add_argument('--news', type=Path, default=ROOT / 'data/news.json')
    parser.add_argument('--pending', action='store_true')
    args = parser.parse_args()
    rows = validate(json.loads(args.summaries.read_text()))
    items = json.loads(args.news.read_text())['items']
    pending = [item for item in items if not any(matching(item, row) for row in rows)]
    if args.pending:
        print(json.dumps(pending, ensure_ascii=False, indent=2))
    else:
        print(f'Korean summaries: {len(rows)} valid; {len(items)-len(pending)}/{len(items)} current headlines covered.')


if __name__ == '__main__':
    main()

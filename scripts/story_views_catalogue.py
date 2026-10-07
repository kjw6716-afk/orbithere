#!/usr/bin/env python3
"""Print owner-only registration SQL for due, actually published story IDs.

This script never connects to a database or reads analytics. Run after verifying
the corresponding Pages deployment; repeated registration preserves start time.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]


def catalogue_sql(root=ROOT, today=None):
    today = today or dt.datetime.now(ZoneInfo('Asia/Seoul')).date()
    ledger = json.loads((root / '_editorial/published.json').read_text())
    values, seen = [], set()
    for item in ledger['items']:
        ident, date = item['id'], item['date']
        if not isinstance(ident, str) or len(ident) > 70 or not re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*', ident):
            raise ValueError('Invalid public story ID')
        if not isinstance(date, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
            raise ValueError('Invalid publication date')
        published = dt.date.fromisoformat(date)
        if ident in seen or published > today:
            raise ValueError('Duplicate or future public story')
        article = json.loads((root / f'_editorial/articles/{ident}.json').read_text())
        if article['id'] != ident or not (root / f'stories/{ident}.html').is_file():
            raise ValueError('Missing published article or page')
        seen.add(ident)
        values.append(f"  ('{ident}', '{date}'::date)")
    if not values:
        return '-- No published stories to register.\n'
    return ('insert into orbit_story_private.catalogue (story_id, published_on)\nvalues\n'
            + ',\n'.join(values) + '\non conflict (story_id) do nothing;\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sql', action='store_true', required=True)
    parser.parse_args()
    print(catalogue_sql(), end='')

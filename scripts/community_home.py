#!/usr/bin/env python3
"""Keep the community homepage and the legacy board on the same document."""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def render():
    source = (ROOT / 'lounge.html').read_text()
    source = source.replace('class="lounge-page"', 'class="lounge-page community-home"')
    source = source.replace('https://orbithere.com/lounge.html', 'https://orbithere.com/')
    source = re.sub(r'<title>.*?</title>', '<title>ORBIT — 밤하늘을 함께 나누는 커뮤니티</title>', source)
    source = re.sub(r'(<meta charset="[^"]+"\s*/?>)', r'\1\n    <meta name="naver-site-verification" content="e4f3202eda5baa4be1a44638c1dc6bbad37aed63">', source)
    source = source.replace('href="lounge.html', 'href="index.html')
    return source


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    target = ROOT / 'index.html'
    expected = render()
    if args.check and target.read_text() != expected:
        raise SystemExit('Run python3 scripts/community_home.py')
    if not args.check:
        target.write_text(expected)
    print('Community homepage matches the shared board document.')


if __name__ == '__main__':
    main()

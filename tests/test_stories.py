import copy
from datetime import datetime
from email.utils import parsedate_to_datetime
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import stories


class EditorialTests(unittest.TestCase):
    def setUp(self):
        self.article = json.loads((stories.ROOT / stories.ARTICLE_DIR / 'moon-face-and-phases.json').read_text())
        self.ledger = {'version': 1, 'items': []}

    def make_article(self, ident, after='2026-09-12'):
        a = copy.deepcopy(self.article)
        a.update(id=ident, title='별과 우주를 읽는 새로운 질문 ' + ident, publishAfter=after)
        return a

    def test_next_publishes_one_at_a_time_without_daily_cap_or_backdating(self):
        second = copy.deepcopy(self.article)
        second.update(id='second-story', title='달의 두 번째 이야기')
        articles = {a['id']: a for a in (self.article, second)}
        first = stories.publish_next(articles, self.ledger, '2026-09-12')
        self.assertIsNotNone(first)
        self.assertEqual(len(self.ledger['items']), 1)
        self.assertIsNotNone(stories.publish_next(articles, self.ledger, '2026-09-12'))
        self.assertIsNone(stories.publish_next(articles, self.ledger, '2026-09-12'))
        self.assertEqual([i['date'] for i in self.ledger['items']], ['2026-09-12', '2026-09-12'])
        self.assertEqual(len({i['id'] for i in self.ledger['items']}), 2)
        later = self.make_article('later-story')
        articles[later['id']] = later
        self.assertEqual(stories.publish_next(articles, self.ledger, '2026-09-15'), later['id'])
        self.assertEqual(self.ledger['items'][-1]['date'], '2026-09-15')

    def test_future_and_empty_queue(self):
        self.article['publishAfter'] = '2026-09-13'
        a = {self.article['id']: self.article}
        self.assertIsNone(stories.publish_next(a, self.ledger, '2026-09-12'))
        self.assertIsNone(stories.publish_next({}, self.ledger, '2026-09-12'))
        self.assertEqual(stories.publish_due(a, self.ledger, '2026-09-12'), [])
        self.assertEqual(stories.publish_due({}, self.ledger, '2026-09-12'), [])
        self.assertEqual(self.ledger['items'], [])

    def test_kst_day_boundary_and_clock_regression(self):
        before = datetime.fromisoformat('2026-09-12T14:59:59+00:00').astimezone(ZoneInfo('Asia/Seoul')).date().isoformat()
        after = datetime.fromisoformat('2026-09-12T15:00:00+00:00').astimezone(ZoneInfo('Asia/Seoul')).date().isoformat()
        self.assertEqual((before, after), ('2026-09-12', '2026-09-13'))
        a = {self.article['id']: self.article}
        stories.publish_next(a, self.ledger, after)
        with self.assertRaises(ValueError):
            stories.publish_next(a, self.ledger, before)
        with self.assertRaises(ValueError):
            stories.publish_due(a, self.ledger, before)

    def test_sources_require_real_official_https_addresses(self):
        for url in ('javascript:alert(1)', 'http://science.nasa.gov/moon/', 'https://nasa.gov.evil.example/',
                    'https://evil.example/?url=nasa.gov', 'https://user:pass@science.nasa.gov/', 'https://nasa.gov:8443/'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                stories.official_url(url)
        self.assertEqual(stories.official_url('https://science.nasa.gov/moon/facts/'), 'https://science.nasa.gov/moon/facts/')

    def test_invalid_schema_and_path_escape(self):
        for field, value in [('id', '../escape'), ('publishAfter','2026-02-30'), ('title',''), ('category','made-up')]:
            a = copy.deepcopy(self.article); a[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError): stories.validate_article(a)
        a = copy.deepcopy(self.article); a['sections'][0]['sources'] = [99]
        with self.assertRaises(ValueError): stories.validate_article(a)
        a = copy.deepcopy(self.article); a['related']['href'] = '//evil.example'
        with self.assertRaises(ValueError): stories.validate_article(a)

    def test_content_escaping_and_jsonld_safety(self):
        a = copy.deepcopy(self.article)
        a['title'] = '</script><img src=x onerror=alert(1)> 달 이야기'
        page = stories.render_article(stories.validate_article(a), '2026-09-12')
        self.assertNotIn('<img src=x', page)
        self.assertIn('&lt;img', page)
        self.assertIn('\\u003c/script\\u003e', page)
        self.assertIn('href="#source-1"', page)

    def test_published_hash_and_duplicate_ledger(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); dest = root / stories.ARTICLE_DIR; dest.mkdir(parents=True)
            file = dest / (self.article['id'] + '.json')
            file.write_text(json.dumps(self.article))
            stories.publish_next({self.article['id']: self.article}, self.ledger, '2026-09-12')
            (root / stories.LEDGER).write_text(json.dumps(self.ledger))
            stories.load(root)
            a = copy.deepcopy(self.article); a['title'] = '누군가 바꿔 놓은 공개 이야기의 제목'
            file.write_text(json.dumps(a))
            with self.assertRaisesRegex(ValueError, 'Published article changed'): stories.load(root)
            file.write_text(json.dumps(self.article))
            self.ledger['items'].append(self.ledger['items'][0])
            (root / stories.LEDGER).write_text(json.dumps(self.ledger))
            with self.assertRaisesRegex(ValueError, 'duplicate'): stories.load(root)

    def test_queued_content_cannot_reach_public_output(self):
        second = copy.deepcopy(self.article)
        second.update(id='unreleased-secret-title',title='아직 승인 대기 중인 특별한 초안 제목')
        articles = {a['id']: a for a in (self.article, second)}
        stories.publish_next({self.article['id']:self.article}, self.ledger, '2026-09-12')
        rendered = stories.outputs(articles, self.ledger)
        self.assertFalse(any(second['id'] in text for text in rendered.values()))
        self.assertFalse(any(second['title'] in text for text in rendered.values()))
        self.assertIn('stories/moon-face-and-phases.html', rendered)
        self.assertNotIn('notes.html</loc>', rendered['sitemap.xml'])

    def test_rss_contains_full_published_story_and_valid_dates(self):
        day = '2026-09-12'
        rss = stories.render_rss([(self.article, day)])
        channel = ET.fromstring(rss).find('channel')
        self.assertEqual(channel.findtext('link'), 'https://orbithere.com/stories.html')
        item = channel.find('item')
        self.assertEqual(item.findtext('guid'),
                         f'https://orbithere.com/stories/{self.article["id"]}.html')
        self.assertEqual(parsedate_to_datetime(item.findtext('pubDate')).utcoffset().total_seconds(), 9 * 3600)
        description = item.findtext('description')
        for section in self.article['sections']:
            self.assertIn(section['heading'], description)
            for paragraph in section['paragraphs']:
                self.assertIn(paragraph, description)
        self.assertIn(self.article['takeaway'], description)
        self.assertIn(self.article['sources'][0]['title'], description)
        self.assertNotIn(self.article['sources'][0]['url'], description)

    def test_rss_keeps_only_the_latest_twenty_items(self):
        items = []
        for n in range(22):
            article = copy.deepcopy(self.article)
            article.update(id=f'rss-story-{n}', title=f'RSS 최신 이야기 순서 확인 {n}')
            items.append((article, '2026-09-12'))
        channel = ET.fromstring(stories.render_rss(items)).find('channel')
        links = [item.findtext('link') for item in channel.findall('item')]
        self.assertEqual(len(links), 20)
        self.assertTrue(links[0].endswith('/rss-story-0.html'))
        self.assertTrue(links[-1].endswith('/rss-story-19.html'))

    def test_empty_archive_has_working_fallback(self):
        html = stories.render_list([])
        self.assertIn('첫 번째 이야기를 준비', html)
        self.assertIn('href="news.html"', html)
        self.assertIn('0편', html)

    def test_batch_publishes_five_after_existing_same_day_release_and_is_idempotent(self):
        today = '2026-09-27'
        articles = {self.article['id']: self.article}
        stories.publish_next(articles, self.ledger, today)
        existing = copy.deepcopy(self.ledger['items'])
        # Deliberately insert out of publication order; an older due date wins.
        for ident, day in [('due-e', today), ('due-c', today), ('due-b', today),
                           ('due-d', today), ('due-a', '2026-09-26'),
                           ('future-story', '2026-09-28')]:
            articles[ident] = self.make_article(ident, day)
        expected = ['due-a', 'due-b', 'due-c', 'due-d', 'due-e']
        self.assertEqual(stories.publish_due(articles, self.ledger, today), expected)
        self.assertEqual(self.ledger['items'][:1], existing)
        self.assertEqual(len(self.ledger['items']), 6)
        self.assertEqual(len({i['id'] for i in self.ledger['items']}), 6)
        for item in self.ledger['items']:
            self.assertEqual(item['date'], today)
            self.assertEqual(item['contentHash'], stories.content_hash(articles[item['id']]))
        rendered = stories.outputs(articles, self.ledger)
        for ident in expected:
            self.assertIn(f'stories/{ident}.html', rendered)
            self.assertIn(f'stories/{ident}.html', rendered['stories.html'])
            self.assertIn(f'stories/{ident}.html', rendered['sitemap.xml'])
            self.assertIn(f'stories/{ident}.html', rendered['rss.xml'])
        self.assertFalse(any('future-story' in content for content in rendered.values()))
        published = copy.deepcopy(self.ledger)
        self.assertEqual(stories.publish_due(articles, self.ledger, today), [])
        self.assertEqual(self.ledger, published)
        self.assertEqual(stories.outputs(articles, self.ledger), rendered)
        self.assertEqual(stories.publish_due(articles, self.ledger, '2026-09-28'), ['future-story'])

    def test_same_day_ledger_still_rejects_early_publication(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            dest = root / stories.ARTICLE_DIR
            dest.mkdir(parents=True)
            articles = {self.article['id']: self.article,
                        'second-story': self.make_article('second-story', '2026-09-28')}
            for article in articles.values():
                (dest / (article['id'] + '.json')).write_text(json.dumps(article))
            stories.publish_due(articles, self.ledger, '2026-09-28')
            ledger_path = root / stories.LEDGER
            ledger_path.write_text(json.dumps(self.ledger))
            self.assertEqual(stories.load(root)[1], self.ledger)
            self.ledger['items'][-1]['date'] = '2026-09-27'
            ledger_path.write_text(json.dumps(self.ledger))
            with self.assertRaisesRegex(ValueError, 'before its allowed date'):
                stories.load(root)

    def test_publish_due_cli_preserves_batch_on_rerun_and_rejects_changed_published_content(self):
        today = '2026-09-27'
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'scripts').mkdir()
            (root / stories.ARTICLE_DIR).mkdir(parents=True)
            for name in ('stories.py', 'site_navigation.py'):
                (root / 'scripts' / name).write_bytes((stories.ROOT / 'scripts' / name).read_bytes())
            for name in ('index.html', 'main.html', 'sitemap.xml'):
                (root / name).write_bytes((stories.ROOT / name).read_bytes())
            articles = [self.article] + [self.make_article(f'cli-story-{n}') for n in range(5)]
            articles.append(self.make_article('future-story', '2026-09-28'))
            for article in articles:
                (root / stories.ARTICLE_DIR / (article['id'] + '.json')).write_text(json.dumps(article))
            stories.publish_next({self.article['id']: self.article}, self.ledger, today)
            (root / stories.LEDGER).write_text(json.dumps(self.ledger))
            command = [sys.executable, 'scripts/stories.py', '--publish-due', '--date', today]
            result = subprocess.run(command, cwd=root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            _, ledger = stories.load(root)
            self.assertEqual(len(ledger['items']), 6)
            self.assertEqual({item['date'] for item in ledger['items']}, {today})
            self.assertFalse((root / 'stories/future-story.html').exists())
            snapshot = {p.relative_to(root): p.read_bytes() for p in root.rglob('*')
                        if p.is_file() and p.suffix != '.pyc'}
            result = subprocess.run(command, cwd=root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('No new publication.', result.stdout)
            self.assertEqual(snapshot, {p.relative_to(root): p.read_bytes() for p in root.rglob('*')
                                        if p.is_file() and p.suffix != '.pyc'})
            article_path = root / stories.ARTICLE_DIR / (self.article['id'] + '.json')
            changed = copy.deepcopy(self.article)
            changed['title'] = '검토되지 않은 변경이 들어간 이야기 제목'
            article_path.write_text(json.dumps(changed))
            result = subprocess.run(command, cwd=root, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Published article changed', result.stderr)
            for path, content in snapshot.items():
                if path != article_path.relative_to(root):
                    self.assertEqual((root / path).read_bytes(), content)

    def test_publication_dates_are_not_displayed(self):
        day = '2026-09-12'
        for page in (stories.render_list([(self.article, day)]), stories.render_article(self.article, day),
                     stories.render_teaser([(self.article, day)], carousel=True), stories.render_teaser([(self.article, day)])):
            self.assertNotIn('<time', page)
        self.assertIn('datePublished', stories.render_article(self.article, day))
        self.assertIn('자료 확인', stories.render_article(self.article, day))

    def test_belt_grows_beyond_the_old_five_story_limit(self):
        items = []
        for n in range(7):
            a = copy.deepcopy(self.article)
            a.update(id=f'belt-story-{n}', title=f'레일에 추가되는 우주 이야기 {n}')
            items.append((a, '2026-09-12'))
        html = stories.render_teaser(items, carousel=True)
        for a, _ in items:
            self.assertIn(f'href="stories/{a["id"]}.html"', html)
        self.assertNotIn('<button', html)


if __name__ == '__main__':
    unittest.main()

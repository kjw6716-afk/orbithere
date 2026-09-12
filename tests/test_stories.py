import copy
from datetime import datetime
import json
from pathlib import Path
import sys
import tempfile
import unittest
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import stories


class EditorialTests(unittest.TestCase):
    def setUp(self):
        self.article = json.loads((stories.ROOT / stories.ARTICLE_DIR / 'moon-face-and-phases.json').read_text())
        self.ledger = {'version': 1, 'items': []}

    def article(self, ident, after='2026-09-12'):
        a = copy.deepcopy(self.article)
        a.update(id=ident, title='별과 우주를 읽는 새로운 질문 ' + ident, publishAfter=after)
        return a

    def test_daily_idempotency_and_no_backfill(self):
        second = copy.deepcopy(self.article)
        second.update(id='second-story', title='달의 두 번째 이야기')
        articles = {a['id']: a for a in (self.article, second)}
        first = stories.publish_next(articles, self.ledger, '2026-09-12')
        self.assertIsNotNone(first)
        self.assertIsNone(stories.publish_next(articles, self.ledger, '2026-09-12'))
        self.assertIsNotNone(stories.publish_next(articles, self.ledger, '2026-09-15'))
        self.assertEqual([i['date'] for i in self.ledger['items']], ['2026-09-12', '2026-09-15'])
        self.assertEqual(len({i['id'] for i in self.ledger['items']}), 2)

    def test_future_and_empty_queue(self):
        self.article['publishAfter'] = '2026-09-13'
        a = {self.article['id']: self.article}
        self.assertIsNone(stories.publish_next(a, self.ledger, '2026-09-12'))
        self.assertIsNone(stories.publish_next({}, self.ledger, '2026-09-12'))
        self.assertEqual(self.ledger['items'], [])

    def test_kst_day_boundary_and_clock_regression(self):
        before = datetime.fromisoformat('2026-09-12T14:59:59+00:00').astimezone(ZoneInfo('Asia/Seoul')).date().isoformat()
        after = datetime.fromisoformat('2026-09-12T15:00:00+00:00').astimezone(ZoneInfo('Asia/Seoul')).date().isoformat()
        self.assertEqual((before, after), ('2026-09-12', '2026-09-13'))
        a = {self.article['id']: self.article}
        stories.publish_next(a, self.ledger, after)
        with self.assertRaises(ValueError):
            stories.publish_next(a, self.ledger, before)

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

    def test_empty_archive_has_working_fallback(self):
        html = stories.render_list([])
        self.assertIn('첫 번째 이야기를 준비', html)
        self.assertIn('href="news.html"', html)
        self.assertIn('0편', html)


if __name__ == '__main__':
    unittest.main()

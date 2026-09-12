import copy
import hashlib
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import news_summaries as briefs


class SummaryTests(unittest.TestCase):
    def fixture(self):
        url = 'https://www.nasa.gov/example/'
        row = {'id': hashlib.sha256(url.encode()).hexdigest()[:16], 'source': 'nasa',
               'url': url, 'titleOriginal': 'An upcoming mission',
               'publishedAt': '2026-09-11T00:00:00Z', 'titleKo': '새로운 탐사 임무 계획',
               'summaryKo': ['새 탐사 임무의 계획을 발표했습니다.', '발사 일정은 후속 준비 상황에 따라 달라질 수 있습니다.'],
               'checkedAt': '2026-09-12', 'method': 'source-checked'}
        return {'version': 1, 'items': [row]}

    def test_checked_brief_and_exact_article_identity(self):
        row = briefs.validate(self.fixture())[0]
        item = {**row, 'title': row['titleOriginal']}
        self.assertTrue(briefs.matching(item, row))
        for field in ('id', 'url', 'source', 'publishedAt', 'title'):
            with self.subTest(field=field):
                self.assertFalse(briefs.matching({**item, field: 'changed'}, row))

    def test_unsafe_unchecked_and_incomplete_entries_are_rejected(self):
        changes = [{'url': 'https://evil.test/story'}, {'source': 'unknown'}, {'id': 'wrong'},
                   {'titleKo': '<script>한글</script>'}, {'titleKo': 'English only'},
                   {'summaryKo': ['제목을 옮긴 한 문장입니다.']},
                   {'summaryKo': ['한글 내용\n다음 줄', '두 번째 문장입니다.']},
                   {'summaryKo': ['가' * 241, '두 번째 문장입니다.']}, {'method': 'draft'},
                   {'checkedAt': '2026-02-30'}, {'publishedAt': 'invalid'}]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                data = self.fixture()
                data['items'][0].update(change)
                briefs.validate(data)

    def test_duplicate_and_malformed_registries_fail(self):
        data = self.fixture()
        data['items'].append(copy.deepcopy(data['items'][0]))
        for bad in [data, {'version': 2, 'items': []}, {'version': 1, 'items': [None]},
                    {'version': 1, 'items': [self.fixture()['items'][0]] * 257}]:
            with self.assertRaises(ValueError):
                briefs.validate(bad)


if __name__ == '__main__':
    unittest.main()

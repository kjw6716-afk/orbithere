import contextlib
import datetime as dt
import importlib.util
import io
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('news',Path(__file__).resolve().parents[1]/'scripts/update_news.py')
news=importlib.util.module_from_spec(spec);spec.loader.exec_module(news)
NOW=dt.datetime(2026,9,11,12,tzinfo=dt.timezone.utc)
SOURCE=news.SOURCES[0]

def rss(items):return ('<rss><channel>'+''.join(items)+'</channel></rss>').encode()
def item(link='https://www.kasi.re.kr/kor/post/newsMaterial/1',title='새로운 관측',date='Fri, 11 Sep 2026 00:00:00 GMT'):
    return f'<item><title>{title}</title><link>{link}</link><pubDate>{date}</pubDate><description>Do not copy this article body.</description></item>'

class NewsTests(unittest.TestCase):
    def test_only_title_link_and_date(self):
        rows=news.parse_feed(rss([item(title='우주 &amp; 별')]),SOURCE,NOW)
        self.assertEqual(rows[0]['title'],'우주 & 별')
        self.assertEqual(set(rows[0]),{'id','source','title','url','publishedAt','language'})
    def test_reject_untrusted_links_and_future_dates(self):
        rows=news.parse_feed(rss([item(),item('javascript:alert(1)'),item('https://www.kasi.re.kr.evil.test/story'),item('https://attacker@www.kasi.re.kr/story'),item('https://www.kasi.re.kr/future',date='Fri, 11 Sep 2037 00:00:00 GMT')]),SOURCE,NOW)
        self.assertEqual(len(rows),1)
    def test_xml_entities_and_size_are_rejected(self):
        for body in [b'<!DOCTYPE rss [<!ENTITY e "expansion">]><rss/>',b'x'*(news.MAX_BYTES+1)]:
            with self.assertRaises(ValueError):news.parse_feed(body,SOURCE,NOW)
    def test_namespace_atom_and_deduplication(self):
        atom=b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Title</title><link rel="alternate" href="https://www.kasi.re.kr/story"/><updated>2026-09-10T10:00:00Z</updated></entry></feed>'
        self.assertEqual(len(news.parse_feed(atom,SOURCE,NOW)),1)
        self.assertEqual(len(news.parse_feed(rss([item(),item()]),SOURCE,NOW)),1)
    def test_bounded_latest_entries(self):
        rows=news.parse_feed(rss([item(f'https://www.kasi.re.kr/{i}') for i in range(20)]),SOURCE,NOW)
        self.assertEqual(len(rows),8)
    def test_partial_outage_preserves_only_failed_source_cache(self):
        old=news.parse_feed(rss([item()]),SOURCE,NOW)
        previous={'items':old,'sources':[{'id':'kasi','lastSuccessfulAt':'2026-09-10T00:00:00Z'}]}
        def fetch(source,now):
            if source['id']=='kasi':raise OSError('offline')
            return [{'source':source['id'],'title':'New title','url':source['home'],'publishedAt':NOW.isoformat()}]
        with contextlib.redirect_stderr(io.StringIO()):result,n=news.collect(previous,fetch,NOW)
        self.assertEqual(n,2);self.assertIn(old[0],result['items'])
        self.assertEqual(result['sources'][0]['status'],'unavailable')
        self.assertEqual(result['sources'][0]['lastSuccessfulAt'],'2026-09-10T00:00:00Z')
    def test_total_outage_never_erases_saved_headlines(self):
        old=news.parse_feed(rss([item()]),SOURCE,NOW)
        def fail(*args):raise TimeoutError()
        with contextlib.redirect_stderr(io.StringIO()):result,n=news.collect({'items':old},fail,NOW)
        self.assertEqual(n,0);self.assertEqual(result['items'],old)


class TranslationTests(unittest.TestCase):
    def row(self, title='New observation'):
        return {'id':'abc', 'source':'nasa', 'url':'https://www.nasa.gov/story',
                'title':title, 'language':'en', 'publishedAt':NOW.isoformat()}
    def translated(self):
        return dict(self.row(), titleKo='새로운 관측', titleKoOriginal='New observation',
                    titleKoMethod='reviewed', titleKoModel='test-model')
    def test_same_source_and_original_reuse_saved_translation(self):
        saved=self.translated()
        fresh=news.preserve_translations([self.row()], {'items':[saved]})[0]
        self.assertEqual(fresh['titleKo'], saved['titleKo'])
        for field, value in [('title','Corrected original'),('source','esa')]:
            changed=dict(self.row(), **{field:value})
            self.assertNotIn('titleKo', news.preserve_translations([changed], {'items':[saved]})[0])
    def test_invalid_or_unrelated_korean_title_is_not_reused(self):
        for key,value in [('titleKo','English only'),('titleKo','<img> 한글'),('titleKo','한글'*121),('titleKoOriginal','Different'),('titleKoMethod','unknown')]:
            saved=dict(self.translated(), **{key:value})
            self.assertFalse(news.valid_translation(saved))
    def test_translation_failure_is_isolated_and_cache_not_retranslated(self):
        import sys
        sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
        import translate_news
        cached=self.translated()
        second=dict(self.row('Another title'),id='second',url='https://www.nasa.gov/two')
        third=dict(self.row('Failed title'),url='https://www.nasa.gov/three')
        data={'items':[cached,second,third,dict(self.row(),language='ko')]}
        calls=[]
        def translate(title):
            calls.append(title)
            if title=='Failed title':raise TimeoutError()
            return '또 다른 제목'
        with contextlib.redirect_stderr(io.StringIO()):count=translate_news.translate_items(data,translate)
        self.assertEqual(count,1)
        self.assertEqual(calls,['Another title','Failed title'])
        self.assertEqual(cached,self.translated())
        self.assertEqual(second['titleKoDraft'],'또 다른 제목')
        self.assertNotIn('titleKo',second)
        self.assertFalse(news.valid_translation(second))
        fresh=dict(self.row('Another title'),url=second['url'])
        self.assertEqual(news.preserve_translations([fresh], {'items':[second]})[0]['titleKoDraft'], '또 다른 제목')
        translate_news.approve_title(data, second['id'], '확인한 새 제목')
        self.assertEqual(second['titleKo'],'확인한 새 제목')
        self.assertNotIn('titleKoDraft',second)
        self.assertNotIn('titleKo',third)

if __name__=='__main__':unittest.main()

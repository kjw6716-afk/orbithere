(function () {
  'use strict';
  var list = document.getElementById('newsList'),
    status = document.getElementById('newsStatus'),
    checked = document.getElementById('newsChecked'),
    button = document.getElementById('reloadNews');
  var sources = {
    kasi: { name: '한국천문연구원', hosts: ['www.kasi.re.kr'] },
    nasa: { name: 'NASA / JPL', hosts: ['www.nasa.gov', 'science.nasa.gov'] },
    esa: { name: 'ESA 우주과학', hosts: ['www.esa.int'] },
  };
  var data = null,
    loading = false;
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function valid(item) {
    try {
      var u = new URL(item.url);
      return (
        sources[item.source] &&
        sources[item.source].hosts.includes(u.hostname) &&
        u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        !u.port &&
        typeof item.title === 'string' &&
        item.title.length > 0 &&
        item.title.length <= 240 &&
        Number.isFinite(Date.parse(item.publishedAt))
      );
    } catch (e) {
      return false;
    }
  }
  function format(stamp) {
    var date = new Date(stamp);
    return Number.isFinite(date.getTime())
      ? date.toLocaleString('ko-KR', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '확인 기록 없음';
  }
  function render() {
    if (!data) return;
    var filter = location.hash.slice(1);
    if (!sources[filter]) filter = 'all';
    document.querySelectorAll('[data-source]').forEach(function (a) {
      if (a.dataset.source === filter) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var items = data.items
      .filter(valid)
      .filter(function (i) {
        return filter === 'all' || i.source === filter;
      })
      .sort(function (a, b) {
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      });
    var unavailable = data.sources.filter(function (s) {
      return (
        sources[s.id] &&
        (filter === 'all' || s.id === filter) &&
        (s.status !== 'ok' ||
          !s.lastSuccessfulAt ||
          Date.now() - Date.parse(s.lastSuccessfulAt) > 48 * 3600000)
      );
    });
    status.hidden = !unavailable.length;
    status.textContent = unavailable.length
      ? unavailable
          .map(function (s) {
            return sources[s.id].name;
          })
          .join(' · ') +
        '의 새 소식을 확인하지 못했어요. 저장된 목록을 표시하며, 공식 사이트에서 최신 소식을 확인할 수 있어요.'
      : '';
    checked.textContent = '마지막 확인 ' + format(data.checkedAt) + ' · ' + items.length + '건';
    list.innerHTML = items.length
      ? items
          .map(function (item) {
            var english = item.language !== 'ko';
            var translated =
              'https://translate.google.com/translate?sl=en&tl=ko&u=' +
              encodeURIComponent(item.url);
            var source = data.sources.find(function (s) {
              return s.id === item.source;
            });
            var stale =
              source &&
              (source.status !== 'ok' ||
                Date.now() - Date.parse(source.lastSuccessfulAt || 0) > 48 * 3600000);
            return (
              '<article class="board-row news-article"><div class="row-meta"><span class="row-category">' +
              sources[item.source].name +
              '</span><span aria-hidden="true">·</span><time datetime="' +
              esc(item.publishedAt) +
              '">' +
              esc(new Date(item.publishedAt).toLocaleDateString('ko-KR')) +
              '</time><span class="news-language">' +
              (english ? '영문' : '한국어') +
              '</span></div><a class="row-title" href="' +
              esc(item.url) +
              '" target="_blank" rel="noopener noreferrer"' +
              (english ? ' lang="en"' : '') +
              '>' +
              esc(item.title) +
              '</a><div class="news-links"><a href="' +
              esc(item.url) +
              '" target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a>' +
              (english
                ? '<a href="' +
                  esc(translated) +
                  '" target="_blank" rel="noopener noreferrer">한국어 번역 ↗</a>'
                : '') +
              '</div>' +
              (stale
                ? '<div class="news-freshness">마지막 정상 확인 ' +
                  esc(format(source.lastSuccessfulAt)) +
                  '</div>'
                : '') +
              '</article>'
            );
          })
          .join('')
      : '<div class="empty-state"><p>아직 가져온 소식이 없어요.<br>아래 공식 사이트에서 최신 소식을 확인해주세요.</p></div>';
  }
  async function load() {
    if (loading) return;
    loading = true;
    button.disabled = true;
    list.setAttribute('aria-busy', 'true');
    var controller = new AbortController(),
      timer = setTimeout(function () {
        controller.abort();
      }, 10000);
    try {
      var response = await fetch('data/news.json', {
        cache: 'no-cache',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('news unavailable');
      var next = await response.json();
      if (next.version !== 1 || !Array.isArray(next.items) || !Array.isArray(next.sources))
        throw new Error('invalid news');
      data = next;
      render();
    } catch (e) {
      status.hidden = false;
      status.textContent =
        '소식을 불러오지 못했어요. 다시 불러오거나 아래 공식 사이트에서 확인해주세요.';
      if (!data) {
        checked.textContent = '연결을 확인해주세요';
        list.innerHTML = '';
      }
    } finally {
      clearTimeout(timer);
      loading = false;
      button.disabled = false;
      list.setAttribute('aria-busy', 'false');
    }
  }
  window.addEventListener('hashchange', render);
  button.onclick = load;
  load();
})();

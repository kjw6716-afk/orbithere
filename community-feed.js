// A read-only window into public conversations. No accounts or read receipts are created.
(function () {
  'use strict';
  var root = document.querySelector('.community-sidebar');
  if (!root) return;
  var sb = window.createOrbitBackend(), active = 'recent', images = new Set();
  var state = { recent: { seq: 0, loaded: false }, photos: { seq: 0, loaded: false } };
  var tabs = [document.getElementById('recentTab'), document.getElementById('photosTab')];
  var refresh = document.getElementById('refreshCommunity');
  function element(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function checked(result) {
    if (result.error) throw result.error;
    return result.data || [];
  }
  function destination(post, comment) {
    var home = document.body.classList.contains('community-home');
    var u = new URL(home ? location.pathname : 'lounge.html', location.href);
    if (document.documentElement.classList.contains('embed')) u.searchParams.set('embed', '1');
    u.searchParams.set('post', post.id);
    if (comment) u.searchParams.set('comment', comment.id);
    u.hash = post.orbit || 'all';
    return u.pathname + u.search + u.hash;
  }
  function person(record) {
    var row = element('div', 'community-person');
    var name = element('span', '', record.nick || '관측자');
    name.dataset.memberId = record.author_id || '';
    var time = element('time');
    time.dateTime = record.created_at;
    var date = new Date(record.created_at);
    time.textContent = date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    time.title = date.toLocaleString('ko-KR');
    row.append(name, time);
    return row;
  }
  function clearImages() { images.forEach(function (url) { URL.revokeObjectURL(url); }); images.clear(); }
  async function recent(container, seq) {
    var comments = checked(await sb.from('comments').select('id,post_id,nick,text,created_at,author_id')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(6));
    var ids = Array.from(new Set(comments.map(function (c) { return c.post_id; })));
    var posts = ids.length ? checked(await sb.from('posts').select('id,title,orbit').in('id', ids)) : [];
    if (seq !== state.recent.seq) return;
    var fragment = document.createDocumentFragment();
    comments.forEach(function (comment) {
      var post = posts.find(function (p) { return p.id === comment.post_id; });
      if (!post) return; // Removed or no longer public posts must not be previewed.
      var item = element('article', 'community-conversation');
      var link = element('a', 'community-link');
      link.href = destination(post, comment); link.dataset.boardNav = '';
      link.append(element('p', 'community-excerpt', comment.text), element('span', 'community-post-title', post.title));
      item.append(person(comment), link); fragment.append(item);
    });
    if (!fragment.childNodes.length) fragment.append(element('p', 'community-state', '아직 나눈 댓글이 없어요. 관심 있는 이야기에 첫 댓글을 남겨보세요.'));
    container.replaceChildren(fragment);
  }
  async function photos(container, seq) {
    var posts = checked(await sb.from('posts').select('id,title,nick,orbit,created_at,author_id,image_paths')
      .not('image_paths', 'eq', '{}').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(4));
    if (seq !== state.photos.seq) return;
    clearImages();
    var fragment = document.createDocumentFragment(), pending = [];
    posts.forEach(function (post) {
      if (!post.image_paths || !post.image_paths.length) return;
      var link = element('a', 'community-photo');
      link.href = destination(post); link.dataset.boardNav = '';
      var img = element('img'); img.alt = post.title + ' 첨부 사진'; img.width = 400; img.height = 250; img.decoding = 'async';
      link.append(img, element('span', 'community-photo-title', post.title), person(post));
      fragment.append(link);
      pending.push(async function () {
        try {
          var result = await sb.storage.from('board-images').download(OrbitBoardMedia.thumbnail(post.image_paths[0]));
          if (result.error) throw result.error;
          if (seq !== state.photos.seq || !img.isConnected) return;
          var url = URL.createObjectURL(result.data); images.add(url); img.src = url;
          img.onerror = function () { URL.revokeObjectURL(url); images.delete(url); img.replaceWith(element('span', 'community-photo-error', '사진을 불러오지 못했어요')); };
        } catch (_) {
          if (seq === state.photos.seq && img.isConnected) img.replaceWith(element('span', 'community-photo-error', '사진을 불러오지 못했어요'));
        }
      });
    });
    if (!fragment.childNodes.length) fragment.append(element('p', 'community-state', '아직 올라온 사진이 없어요. 직접 찍은 하늘을 게시판에 나눠주세요.'));
    container.replaceChildren(fragment);
    await Promise.all(pending.map(function (task) { return task(); }));
  }
  async function load(name) {
    var entry = state[name], seq = ++entry.seq;
    var container = document.getElementById(name === 'recent' ? 'recentConversations' : 'recentPhotos');
    if (active === name) refresh.disabled = true;
    container.setAttribute('aria-busy', 'true');
    if (!entry.loaded) container.replaceChildren(element('p', 'community-state', name === 'recent' ? '최근 대화를 불러오고 있어요…' : '사진을 불러오고 있어요…'));
    try {
      if (!sb) throw new Error('unavailable');
      await (name === 'recent' ? recent : photos)(container, seq);
      if (seq === entry.seq) entry.loaded = true;
    } catch (_) {
      if (seq === entry.seq) {
        entry.loaded = false;
        if (name === 'photos') clearImages();
        container.replaceChildren(element('p', 'community-state', '소식을 불러오지 못했어요. 새로고침을 눌러 다시 확인해주세요.'));
      }
    } finally {
      if (seq === entry.seq) {
        container.setAttribute('aria-busy', 'false');
        if (active === name) refresh.disabled = false;
      }
    }
  }
  function select(index) {
    active = index ? 'photos' : 'recent';
    tabs.forEach(function (tab, i) {
      tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = i !== index;
    });
    refresh.disabled = false;
    if (!state[active].loaded) load(active);
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(i); });
    tab.addEventListener('keydown', function (event) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      var next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - i;
      tabs[next].focus(); select(next);
    });
  });
  refresh.addEventListener('click', function () { load(active); });
  window.addEventListener('pagehide', clearImages);
  window.addEventListener('pageshow', function (event) { if (event.persisted && state.photos.seq) load('photos'); });
  load('recent');
})();

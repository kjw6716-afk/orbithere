(function () {
  'use strict';
  var sb = window.createOrbitBackend(),
    $ = function (id) {
      return document.getElementById(id);
    };
  var channels = [
    ['all', '전체'],
    ['report', '관측 후기'],
    ['gear', '장비'],
    ['live', '지금 하늘'],
    ['ask', '질문'],
    ['free', '자유게시판'],
  ];
  var emojis = ['⭐', '🔥', '😂', '🥰', '👏', '❤️'],
    userId = null,
    isAdmin = false,
    writerPromise = null;
  var embed = document.documentElement.classList.contains('embed'),
    route = 0,
    commentSeq = 0,
    view = '',
    channel = 'all',
    activity = '',
    query = '',
    posts = [],
    more = false,
    listBusy = false,
    cache = null;
  var photos = [],
    preparing = false,
    busy = false,
    attempt = null,
    detail = null,
    comments = [],
    commentsMore = false,
    commentBusy = false,
    commentDrafts = {},
    commentAttempts = {},
    imageURLs = new Set();
  var reactionBusy = false,
    reported = new Set(),
    boardReady = false,
    activeURL = location.href;
  var activityScopes = [['mine', '내 글'], ['joined', '참여한 글'], ['unread', '새 답글']],
    summarySeq = 0, summaryTime = 0, unreadThreads = 0, commentsLoaded = false;
  var activityReader = OrbitBoardActivity.createReader({
    client: sb,
    user: function () { return userId; },
    invalidate: function () { cache = null; },
    changed: function () { cache = null; $('readSyncStatus').hidden = true; refreshActivity(); },
    error: function () { $('readSyncStatus').hidden = false; },
  });
  function activityURL(scope) {
    var u = new URL('lounge.html', location.href);
    if (embed) u.searchParams.set('embed', '1');
    if (scope) u.searchParams.set('activity', scope);
    u.hash = 'all';
    return u.pathname + u.search + u.hash;
  }
  function updateActivityLink() {
    $('activityLink').href = activityURL(activity ? '' : unreadThreads ? 'unread' : 'mine');
    $('activityLink').firstChild.textContent = activity ? '전체 글 ' : '내 활동 ';
    $('activityBadge').hidden = !!activity || !unreadThreads;
    $('activityBadge').textContent = '새 답글 ' + (unreadThreads > 99 ? '99+' : unreadThreads);
  }
  async function refreshActivity() {
    var seq = ++summarySeq, actor = userId;
    if (!actor) { unreadThreads = 0; updateActivityLink(); $('activityStatus').hidden = true; return; }
    try {
      var result = checked(await sb.rpc('board_activity_summary'));
      if (seq !== summarySeq || userId !== actor) return;
      unreadThreads = Math.max(0, Number(result) || 0);
      summaryTime = Date.now();
      $('activityStatus').hidden = true;
      updateActivityLink();
    } catch (_) {
      if (seq === summarySeq && userId === actor) $('activityStatus').hidden = false;
    }
  }
  function activityHeading() {
    $('boardTitle').textContent = activity ? '내 활동' : '별빛 게시판';
    $('boardIntro').textContent = activity ? '내가 남긴 이야기와 이어지는 대화를 확인해요.' : '오늘 본 하늘부터, 아직 모르는 별까지.';
    $('activityPanel').hidden = !activity;
    document.querySelector('.board-filters').hidden = !!activity;
    $('activityTabs').innerHTML = activityScopes.map(function (scope) {
      return '<a data-board-nav href="' + esc(activityURL(scope[0])) + '"' +
        (activity === scope[0] ? ' aria-current="page"' : '') + '>' + scope[1] + '</a>';
    }).join('');
    $('detailActivityLink').href = activityURL(activity || 'mine');
    updateActivityLink();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function validId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
  }
  function nick() {
    try {
      return localStorage.getItem('orbit_nickname') || '';
    } catch (e) {
      return '';
    }
  }
  function label(id) {
    var c = channels.find(function (c) {
      return c[0] === id;
    });
    return c ? c[1] : '이전 게시판';
  }
  function date(iso) {
    var d = new Date(iso);
    return Number.isFinite(d.getTime())
      ? d.toLocaleString('ko-KR', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
  }
  function viewLabel(value) {
    var n = Number(value);
    return '조회 ' + (value != null && Number.isSafeInteger(n) && n >= 0 ? n.toLocaleString('ko-KR') : '—');
  }
  async function loadPostViews(p, token) {
    function show(value) {
      if (token !== route || detail !== p) return;
      p.view_count = value;
      $('postViews').textContent = viewLabel(value);
      // The cached list must show the count obtained after opening this post.
      if (cache) {
        cache.posts.forEach(function (row) { if (row.id === p.id) row.view_count = value; });
        var pins = document.createElement('div');
        pins.innerHTML = cache.pins;
        var count = pins.querySelector('[data-post-views="' + p.id + '"]');
        if (count) count.textContent = viewLabel(value);
        cache.pins = pins.innerHTML;
      }
    }
    try {
      var counts = checked(await sb.from('post_view_counts').select('view_count').eq('post_id', p.id).maybeSingle());
      show(counts ? counts.view_count : 0);
    } catch (_) { /* An unavailable counter must never prevent reading. */ }
    if (token !== route || detail !== p) return;
    try {
      await ensureWriter();
      if (token !== route || detail !== p) return;
      var count = checked(await sb.rpc('record_post_view', { p_post_id: p.id }));
      if (count != null) show(count);
    } catch (_) { /* Keep the last known count if authentication/counting fails. */ }
  }
  function status(message, error) {
    $('loungeStatus').textContent = message || '';
    $('loungeStatus').classList.toggle('error', !!error);
  }
  function writeStatus(message, error) {
    $('writeStatus').textContent = message || '';
    $('writeStatus').classList.toggle('error', !!error);
  }
  function hint(error) {
    var m = String((error && error.message) || '');
    if (/orbit_pin_limit/.test(m))
      return '상단 공지는 최대 3개예요. 기존 공지를 해제한 뒤 다시 시도해주세요.';
    if (/orbit_photo_rate_limit/.test(m))
      return '사진은 한 시간에 20장까지 준비할 수 있어요. 잠시 후 다시 시도해주세요.';
    if (/orbit_(comment_|report_)?rate_limit/.test(m))
      return '요청이 너무 빨라요. 잠시 쉬었다가 다시 시도해주세요.';
    if (/orbit_photo_missing|orbit_photo_retry/.test(m))
      return '사진 업로드를 완료하지 못했어요. 다시 시도해주세요.';
    if (/orbit_not_admin/.test(m)) return '공지 고정은 관리자만 할 수 있어요.';
    if (error && error.code === '23514')
      return '닉네임 2~12자, 제목 1~80자, 내용 1~5,000자를 확인해주세요.';
    if (error && error.code === '42501')
      return '작성 권한을 확인하지 못했어요. 다시 로그인한 뒤 시도해주세요.';
    return /[가-힣]/.test(m) ? m.slice(0, 180) : '연결을 확인한 뒤 다시 시도해주세요.';
  }
  function checked(result) {
    if (result.error) throw result.error;
    return result.data;
  }
  async function ensureWriter() {
    if (writerPromise) return writerPromise;
    writerPromise = (async function () {
      if (!sb) throw new Error('서버 연결을 준비하지 못했어요. 새로고침해주세요.');
      if (!boardReady) {
        var v = checked(await sb.rpc('board_version'));
        if (v !== 1)
          throw new Error('게시판 업데이트를 준비하고 있어요. 잠시 후 다시 시도해주세요.');
        boardReady = true;
      }
      var s = checked(await sb.auth.getSession()),
        user = s.session && s.session.user;
      if (!user) user = checked(await sb.auth.signInAnonymously()).user;
      if (!user) throw new Error('작성 권한을 확인하지 못했어요.');
      userId = user.id;
      return user.id;
    })();
    try {
      return await writerPromise;
    } finally {
      writerPromise = null;
    }
  }
  function join() {
    if (embed && parent !== window) parent.postMessage({ orbit: 'join' }, location.origin);
    else location.href = 'main.html#join';
  }
  function url(options) {
    var u = new URL('lounge.html', location.href);
    if (embed) u.searchParams.set('embed', '1');
    if (activity) u.searchParams.set('activity', activity);
    if (query) u.searchParams.set('q', query);
    u.hash = channel;
    if (options && options.post) u.searchParams.set('post', options.post);
    if (options && options.write) u.searchParams.set('write', '1');
    return u.pathname + u.search + u.hash;
  }
  function dirty() {
    return $('postTitle').value.trim() || $('postInput').value.trim() || photos.length ||
      $('writerNickname').value.trim() || Object.keys(OrbitBoardWriting.collect($('postForm'))).length;
  }
  function syncWriter() {
    var name = nick();
    $('writerGate').hidden = !!name;
    $('writerName').hidden = !name;
    $('writerName').textContent = name ? name + ' 이름으로 남겨요.' : '';
  }
  function prepareNickname() {
    if (nick()) return true;
    var input = $('writerNickname'), value = input.value.trim();
    if (value.length < 2 || value.length > 12 || /[<>"'\/\\]/.test(value)) {
      writeStatus('닉네임을 2~12자로 정해주세요. < > 따옴표와 빗금은 사용할 수 없어요.', true);
      input.focus();
      return false;
    }
    try {
      localStorage.setItem('orbit_nickname', value);
      if (!localStorage.getItem('orbit_jointime')) {
        localStorage.setItem('orbit_joindate', new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }));
        localStorage.setItem('orbit_jointime', Date.now());
      }
    } catch (_) {
      writeStatus('이 브라우저에 닉네임을 저장하지 못했어요. 사이트 저장소를 허용한 뒤 다시 시도해주세요.', true);
      return false;
    }
    syncWriter();
    if (embed && parent !== window) parent.postMessage({ orbit: 'profileChanged' }, location.origin);
    return true;
  }
  function canLeave() {
    if (busy || preparing || commentBusy) {
      status('진행 중인 저장을 마친 뒤 이동해주세요.', true);
      return false;
    }
    if (attempt && attempt.uncertain) {
      status('등록 여부를 아직 확인하지 못했어요. ‘글 남기기’를 다시 눌러 확인해주세요.', true);
      return false;
    }
    if (
      view === 'editor' &&
      dirty() &&
      !confirm('작성 중인 글을 닫을까요? 이 화면으로 돌아오면 초안이 남아 있어요.')
    )
      return false;
    return true;
  }
  function navigate(href, replace) {
    if (!canLeave()) return;
    if (view === 'list')
      cache = {
        key: activity + '|' + channel + '|' + query,
        posts: posts.slice(),
        more: more,
        pins: activity || $('pinnedPosts').hidden ? '' : $('pinnedPosts').innerHTML,
        scroll: window.scrollY,
      };
    history[replace ? 'replaceState' : 'pushState'](null, '', href);
    showRoute();
  }
  function revokeImages() {
    imageURLs.forEach(function (u) {
      URL.revokeObjectURL(u);
    });
    imageURLs.clear();
  }
  async function loadImage(img, path, token) {
    try {
      var data = checked(await sb.storage.from('board-images').download(path));
      if (token !== route || !img.isConnected) return;
      var u = URL.createObjectURL(data);
      imageURLs.add(u);
      img.src = u;
      img.hidden = false;
      var retry = img.parentElement.querySelector('.photo-retry');
      if (retry) retry.remove();
    } catch (e) {
      if (token !== route || !img.isConnected) return;
      img.hidden = true;
      if (img.closest('.detail-image') && !img.parentElement.querySelector('.photo-retry')) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'button photo-retry';
        b.textContent = '사진 다시 불러오기';
        b.onclick = async function () {
          b.disabled = true;
          await loadImage(img, path, token);
          b.disabled = false;
        };
        img.parentElement.appendChild(b);
      }
    }
  }
  function hydrateImages(root, token) {
    root.querySelectorAll('img[data-path]').forEach(function (img) {
      loadImage(img, img.dataset.path, token);
    });
  }
  function syncFilters() {
    $('activeChannel').textContent = channel === 'all' ? '모든 이야기' : label(channel);
    $('questionFilter').checked = channel === 'ask';
    var all = new URL(url(), location.href);
    all.hash = 'all';
    $('clearChannel').href = all.pathname + all.search + all.hash;
    // Existing category URLs still work, with a visible way back to the full list.
    $('clearChannel').hidden = channel === 'all' || channel === 'ask';
  }
  function emptyList() {
    var title, message, action, href;
    if (activity && !userId) {
      title = '이 브라우저에서 시작한 활동이 없어요';
      message = '글이나 댓글을 남기면 여기서 다시 찾을 수 있어요. 닉네임이 같아도 다른 브라우저의 글은 연결되지 않아요.';
      action = '이야기 둘러보기'; href = activityURL('');
    } else if (query) {
      title = '검색 결과가 없어요';
      message = '다른 단어로 찾아보거나 검색어를 지워보세요.';
      action = '검색어 지우기';
      var clear = new URL(url(), location.href);
      clear.searchParams.delete('q');
      href = clear.pathname + clear.search + clear.hash;
    } else if (activity) {
      title = activity === 'unread' ? '새로 확인할 답글이 없어요' : activity === 'joined' ? '아직 참여한 대화가 없어요' : '아직 남긴 글이 없어요';
      message = activity === 'unread' ? '내 글이나 댓글 단 글에 새 답글이 달리면 여기서 확인할 수 있어요.' :
        activity === 'joined' ? '다른 사람의 글에 댓글을 남기면 이곳에 모아드려요.' : '사진 없이 한 줄만 남겨도 좋아요.';
      action = activity === 'mine' ? '한 줄 남기기' : '이야기 둘러보기';
      href = activity === 'mine' ? url({ write: true }) : activityURL('');
    } else {
      title = channel === 'ask' ? '아직 올라온 질문이 없어요' :
        channel === 'all' ? '오늘 하늘은 어땠나요?' : '이 분류에는 아직 글이 없어요';
      message = channel === 'ask' ? '별 이름을 몰라도 괜찮아요. 궁금했던 것부터 물어보세요.' :
        channel === 'all' ? '아직 나눈 이야기가 없어요. 사진 없이 한 줄만 남겨도 좋아요.' :
        '오늘 본 하늘이나 문득 떠오른 생각을 편하게 나눠주세요.';
      action = channel === 'ask' ? '질문 남기기' : '한 줄 남기기';
      href = url({ write: true });
    }
    var all = new URL(url(), location.href);
    all.hash = 'all';
    return '<div class="empty-state board-empty"><h2>' + title + '</h2><p>' + message + '</p>' +
      (!activity && !query && channel === 'all' ? '<p class="empty-example">“퇴근길에 밝은 점 하나를 봤어요. 이름은 모르지만 한참 바라봤네요.”</p>' : '') +
      '<div class="empty-actions"><a class="button primary" data-board-nav href="' + esc(href) + '">' + action + '</a>' +
      (channel !== 'all' ? '<a class="text-button" data-board-nav href="' + esc(all.pathname + all.search + all.hash) + '">' +
        (query ? '모든 글에서 검색' : '전체 글 보기') + '</a>' : '') + '</div></div>';
  }
  function renderPosts() {
    $('feedContext').textContent =
      (query ? '“' + query + '” 검색 · ' : (activity ? activityScopes.find(function (s) { return s[0] === activity; })[1] : label(channel)) + ' · ') + posts.length + '개 표시';
    $('postList').innerHTML = posts.length
      ? posts
          .map(function (p) {
            var href = url({ post: p.id }),
              images = p.image_paths || [];
            return (
              '<article class="board-row" id="post-' +
              esc(p.id) +
              '"><div class="row-main"><div class="row-category">' +
              esc(label(p.orbit)) +
              (activity && p.is_pinned ? ' · 공지' : '') +
              (activity && Number(p.unread_count) > 0 ? '<span class="reply-badge">새 답글 ' + Math.min(999, Number(p.unread_count)) + '개</span>' : '') +
              '</div><a class="row-title" data-board-nav href="' +
              esc(href) +
              '">' +
              esc(p.title) +
              '</a><div class="row-meta"><span>' +
              esc(p.nick) +
              '</span><span aria-hidden="true">·</span><time datetime="' +
              esc(p.created_at) +
              '">' +
              esc(date(p.created_at)) +
              '</time><span class="view-count">' + viewLabel(p.view_count) + '</span></div></div><div class="row-side">' +
              (images.length
                ? '<a class="row-thumb-link" data-board-nav href="' +
                  esc(href) +
                  '" aria-label="' +
                  esc(p.title) +
                  ' 사진 보기"><img data-path="' +
                  esc(OrbitBoardMedia.thumbnail(images[0])) +
                  '" alt="첨부 사진 미리보기" loading="lazy"><span class="image-count">' +
                  images.length +
                  '</span></a>'
                : '') +
              '<a class="comment-count" data-board-nav href="' +
              esc(href) +
              '" aria-label="댓글 ' +
              Number(p.comment_count || 0) +
              '개"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z"/></svg>' +
              Number(p.comment_count || 0) +
              '</a></div></article>'
            );
          })
          .join('')
      : emptyList();
    $('writeBottom').hidden = !posts.length;
    $('loadMore').hidden = !more;
    $('loadMore').disabled = listBusy;
    hydrateImages($('postList'), route);
  }
  async function loadList(append) {
    if (listBusy) return;
    listBusy = true;
    var token = route,
      last = append && posts.at(-1);
    $('postList').setAttribute('aria-busy', 'true');
    $('loadMore').disabled = true;
    $('refreshList').disabled = true;
    $('pageStatus').textContent = '';
    if (!posts.length)
      $('postList').innerHTML = '<p class="empty-state">게시글을 불러오고 있어요…</p>';
    try {
      if (activity && !userId) {
        posts = []; more = false; renderPosts();
        $('pinnedPosts').hidden = true;
        return;
      }
      var requests = [
        activity ? sb.rpc('board_activity_posts', {
          p_scope: activity, p_query: query,
          p_before: last ? last.created_at : null, p_before_id: last ? last.id : null, p_limit: 21,
        }) : sb.rpc('board_posts', {
          p_orbit: channel === 'all' ? null : channel,
          p_query: query,
          p_before: last ? last.created_at : null,
          p_before_id: last ? last.id : null,
          p_limit: 21,
          p_pinned: false,
        }),
      ];
      if (!append && !activity) requests.push(sb.rpc('board_posts', { p_pinned: true, p_limit: 3 }));
      var results = await Promise.all(requests);
      if (token !== route) return;
      var rows = checked(results[0]);
      more = rows.length > 20;
      var seen = new Set(
        append
          ? posts.map(function (p) {
              return p.id;
            })
          : [],
      );
      posts = (append ? posts : []).concat(
        rows.slice(0, 20).filter(function (p) {
          return !seen.has(p.id);
        }),
      );
      revokeImages();
      renderPosts();
      if (!append && !activity) {
        var pins = results[1];
        if (!pins.error) {
          $('pinnedPosts').innerHTML = (pins.data || [])
            .map(function (p) {
              return (
                '<a class="pinned-row" data-board-nav href="' +
                esc(url({ post: p.id })) +
                '"><span class="pin-badge">공지</span><span class="pin-title">' +
                esc(p.title) +
                '</span><span class="view-count" data-post-views="' + esc(p.id) + '">' + viewLabel(p.view_count) + '</span><span class="pin-arrow" aria-hidden="true">›</span></a>'
              );
            })
            .join('');
          $('pinnedPosts').hidden = !pins.data.length;
        } else status('게시글은 불러왔지만 공지를 확인하지 못했어요. 새로고침해주세요.', true);
      }
    } catch (e) {
      if (token !== route) return;
      status((posts.length ? '새로고침 실패 — ' : '게시판을 불러오지 못했어요. ') + hint(e), true);
      $('pageStatus').textContent = '불러오지 못했어요. 다시 시도해주세요.';
      if (!posts.length)
        $('postList').innerHTML =
          '<div class="load-error"><p>연결이 잠시 원활하지 않아요.</p><button class="button" data-action="retry-list">다시 불러오기</button></div>';
    } finally {
      if (token === route) {
        listBusy = false;
        $('postList').setAttribute('aria-busy', 'false');
        $('loadMore').disabled = false;
        $('refreshList').disabled = false;
      }
    }
  }
  function reportButton(type, id) {
    return (
      '<button type="button" class="text-button btn-report" data-report="' +
      type +
      '" data-id="' +
      esc(id) +
      '">신고·삭제 요청</button>'
    );
  }
  async function loadDetail(id, token) {
    $('postDetail').innerHTML = '<p class="empty-state">글을 불러오고 있어요…</p>';
    try {
      var columns = 'id,title,nick,orbit,text,created_at,author_id,image_paths,is_pinned,pinned_at';
      var result = await sb.from('posts').select(columns + ',observation').eq('id', id).maybeSingle();
      // Keep old posts readable while a rollout's optional column is unavailable.
      if (result.error && /^(42703|PGRST204)$/.test(result.error.code || ''))
        result = await sb.from('posts').select(columns).eq('id', id).maybeSingle();
      var p = checked(result);
      if (token !== route) return;
      if (!p) {
        $('postDetail').innerHTML =
          '<div class="empty-state"><h1>글을 찾을 수 없어요</h1><p>삭제된 글이거나 주소가 올바르지 않아요.</p></div>';
        return;
      }
      detail = p;
      document.title = p.title + ' | Orbit';
      var own = p.author_id && p.author_id === userId;
      $('postDetail').innerHTML =
        '<div class="detail-category">' +
        (p.is_pinned ? '<span class="pin-badge">공지</span> · ' : '') +
        esc(label(p.orbit)) +
        '</div><h1 class="detail-title">' +
        esc(p.title) +
        '</h1><div class="detail-meta"><span>' +
        esc(p.nick) +
        '</span><span aria-hidden="true">·</span><time datetime="' +
        esc(p.created_at) +
        '">' +
        esc(date(p.created_at)) +
        '</time><span class="view-count" id="postViews">조회 —</span></div><p class="glossary-help" id="glossaryHelp" hidden>밑줄 친 용어를 누르면 짧은 설명을 볼 수 있어요.</p><div class="detail-body"></div><div id="observationRecord"></div><div class="detail-images">' +
        (p.image_paths || [])
          .map(function (path, i) {
            return (
              '<figure class="detail-image"><img data-path="' +
              esc(path) +
              '" alt="' +
              esc(p.title) +
              ' · 첨부 사진 ' +
              (i + 1) +
              '" loading="lazy"><figcaption>첨부 사진 ' +
              (i + 1) +
              ' / ' +
              p.image_paths.length +
              '</figcaption></figure>'
            );
          })
          .join('') +
        '</div><div class="reaction-row" id="reactionRow" aria-label="공감"></div><div class="detail-actions"><button class="button subtle" type="button" data-action="share">글 공유</button><span class="spacer"></span>' +
        (isAdmin
          ? '<button class="text-button" type="button" data-action="pin">' +
            (p.is_pinned ? '공지 해제' : '공지로 고정') +
            '</button>'
          : '') +
        (own || isAdmin
          ? '<button class="text-button" type="button" data-action="delete-post">글 삭제</button>'
          : '') +
        (!own ? reportButton('post', p.id) : '') +
        '</div><section class="comments-section" aria-label="댓글"><div class="comments-heading"><h2>댓글</h2><button class="text-button" type="button" data-action="refresh-comments">새로고침</button></div><div id="commentList"></div><p class="comment-message" id="commentMessage" role="status"></p><button class="button subtle" type="button" id="moreComments" hidden>이전 댓글 더 보기</button><form class="comment-form" id="commentForm"><label class="sr-only" for="commentInput">댓글 내용</label><textarea id="commentInput" maxlength="300" rows="2" required placeholder="경험을 나누거나 궁금한 점을 더 물어보세요. (300자 이내)"></textarea><button class="button primary" type="submit">등록</button></form></section>';
      $('postDetail').querySelector('.detail-body').textContent = p.text;
      OrbitBoardWriting.render($('observationRecord'), p.observation);
      if (window.OrbitBoardGlossary) {
        var termCount = OrbitBoardGlossary.annotate([
          $('postDetail').querySelector('.detail-body'),
          ...$('observationRecord').querySelectorAll('dd'),
        ]);
        $('glossaryHelp').hidden = termCount === 0;
      }
      $('commentInput').value = commentDrafts[p.id] || '';
      $('commentInput').addEventListener('input', function () {
        commentDrafts[p.id] = this.value;
      });
      $('commentForm').addEventListener('submit', submitComment);
      $('moreComments').onclick = function () {
        loadComments(true);
      };
      comments = [];
      commentsMore = false;
      hydrateImages($('postDetail'), token);
      loadComments(false);
      loadReactions(p, token);
      loadPostViews(p, token);
      $('postDetail').focus({ preventScroll: true });
    } catch (e) {
      if (token !== route) return;
      status('글을 불러오지 못했어요. ' + hint(e), true);
      $('postDetail').innerHTML =
        '<div class="load-error"><p>연결을 확인하고 다시 시도해주세요.</p><button class="button" data-action="retry-detail">다시 불러오기</button></div>';
    }
  }
  function afterCursor(q, row) {
    if (!validId(row.id) || !/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(row.created_at))
      throw new Error('댓글 위치를 확인하지 못했어요. 새로고침해주세요.');
    return q.or(
      'created_at.lt.' +
        row.created_at +
        ',and(created_at.eq.' +
        row.created_at +
        ',id.lt.' +
        row.id +
        ')',
    );
  }
  async function loadComments(append) {
    var p = detail,
      token = route,
      seq = ++commentSeq;
    if (!p) return;
    commentsLoaded = false;
    activityReader.reset();
    $('commentMessage').textContent = '댓글을 불러오는 중…';
    $('moreComments').disabled = true;
    try {
      var q = sb
        .from('comments')
        .select('id,post_id,nick,text,created_at,author_id')
        .eq('post_id', p.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(21);
      if (append && comments.length) q = afterCursor(q, comments.at(-1));
      var data = checked(await q);
      if (token !== route || seq !== commentSeq) return;
      commentsMore = data.length > 20;
      comments = (append ? comments : []).concat(data.slice(0, 20));
      $('commentList').innerHTML = comments
        .map(function (c) {
          var own = c.author_id && c.author_id === userId;
          return (
            '<article class="comment-item" id="comment-' +
            esc(c.id) +
            '"><div class="comment-meta"><span class="comment-author">' +
            esc(c.nick) +
            '</span>' +
            (c.author_id && c.author_id === p.author_id
              ? '<span class="author-badge">글쓴이</span>'
              : '') +
            '<time datetime="' +
            esc(c.created_at) +
            '">' +
            esc(date(c.created_at)) +
            '</time></div><p class="comment-body">' +
            esc(c.text) +
            '</p><div class="comment-actions">' +
            (own || isAdmin
              ? '<button class="text-button" data-delete-comment="' +
                esc(c.id) +
                '" type="button">댓글 삭제</button>'
              : '') +
            (!own ? reportButton('comment', c.id) : '') +
            '</div></article>'
          );
        })
        .join('');
      $('commentMessage').textContent = comments.length
        ? '최근 댓글부터 ' + comments.length + '개 표시'
        : '첫 댓글을 남겨보세요.';
      $('moreComments').hidden = !commentsMore;
      commentsLoaded = true;
      activityReader.observe($('commentList'), p.id, comments);
    } catch (e) {
      if (token === route && seq === commentSeq)
        $('commentMessage').textContent =
          '댓글을 불러오지 못했어요. 새로고침으로 다시 시도해주세요.';
    } finally {
      if (token === route && seq === commentSeq) $('moreComments').disabled = false;
    }
  }
  async function submitComment(ev) {
    ev.preventDefault();
    if (commentBusy) return;
    if (!nick()) {
      join();
      return;
    }
    var input = $('commentInput'),
      text = input.value.trim(),
      p = detail,
      token = route;
    if (!text) return;
    commentBusy = true;
    var button = $('commentForm').querySelector('button');
    button.disabled = true;
    input.disabled = true;
    try {
      await ensureWriter();
      var pending = commentAttempts[p.id],
        alreadySaved = false;
      if (pending && pending.text === text) {
        var existing = checked(
          await sb
            .from('comments')
            .select('id,post_id,text,author_id')
            .eq('id', pending.id)
            .maybeSingle(),
        );
        alreadySaved = !!(
          existing &&
          existing.post_id === p.id &&
          existing.author_id === userId &&
          existing.text === text
        );
      } else pending = commentAttempts[p.id] = { id: crypto.randomUUID(), text: text };
      if (!alreadySaved)
        checked(
          await sb
            .from('comments')
            .insert({
              id: pending.id,
              post_id: p.id,
              nick: nick(),
              text: text,
              author_id: userId,
              author_device: userId,
            }),
        );
      delete commentAttempts[p.id];
      delete commentDrafts[p.id];
      cache = null;
      if (token !== route) return;
      input.value = '';
      status('댓글을 등록했어요.');
      refreshActivity();
      await loadComments(false);
    } catch (e) {
      if (token === route) status('댓글 등록 실패 — ' + hint(e), true);
    } finally {
      commentBusy = false;
      if (button.isConnected) {
        button.disabled = false;
        input.disabled = false;
      }
    }
  }
  async function loadReactions(p, token) {
    try {
      var rows = checked(await sb.rpc('reaction_summary', { p_post_ids: [p.id], p_device: null }));
      if (token !== route) return;
      $('reactionRow').innerHTML = emojis
        .map(function (emoji) {
          var r =
            rows.find(function (r) {
              return r.emoji === emoji;
            }) || {};
          return (
            '<button type="button" class="rx-chip' +
            (r.mine ? ' mine' : '') +
            '" data-emoji="' +
            emoji +
            '" aria-pressed="' +
            !!r.mine +
            '" aria-label="' +
            emoji +
            ' 공감 ' +
            Number(r.n || 0) +
            '개">' +
            emoji +
            ' ' +
            Number(r.n || 0) +
            '</button>'
          );
        })
        .join('');
    } catch (e) {
      if (token === route)
        $('reactionRow').innerHTML =
          '<button class="text-button" type="button" data-action="retry-reactions">공감 다시 불러오기</button>';
    }
  }
  async function toggleReaction(button) {
    if (reactionBusy || !detail) return;
    reactionBusy = true;
    var p = detail,
      token = route,
      emoji = button.dataset.emoji,
      on = button.getAttribute('aria-pressed') !== 'true';
    $('reactionRow')
      .querySelectorAll('button')
      .forEach(function (b) {
        b.disabled = true;
      });
    try {
      await ensureWriter();
      checked(
        on
          ? await sb
              .from('reactions')
              .insert({ post_id: p.id, emoji: emoji, device_id: userId, author_id: userId })
          : await sb.rpc('delete_reaction', { p_post_id: p.id, p_emoji: emoji, p_device: userId }),
      );
      await loadReactions(p, token);
    } catch (e) {
      if (token === route) {
        status('공감 저장 실패 — ' + hint(e), true);
        await loadReactions(p, token);
      }
    } finally {
      reactionBusy = false;
    }
  }
  function openReport(type, id, button) {
    if (reported.has(type + id)) return;
    var dialog = document.createElement('dialog');
    dialog.className = 'board-dialog';
    dialog.setAttribute('aria-labelledby', 'reportTitle');
    var reasons = [
      ['spam', '광고·도배'],
      ['abuse', '욕설·혐오'],
      ['adult', '부적절한 내용'],
      ['privacy', '개인정보 노출'],
      ['etc', '기타 · 내 글 삭제 요청'],
    ];
    dialog.innerHTML =
      '<form><h2 id="reportTitle">신고·삭제 요청</h2><p>운영자만 확인합니다. 비밀번호나 신분증은 보내지 마세요.</p>' +
      reasons
        .map(function (r, i) {
          return (
            '<label><input type="radio" name="reason" value="' +
            r[0] +
            '"' +
            (!i ? ' checked' : '') +
            '> ' +
            r[1] +
            '</label>'
          );
        })
        .join('') +
      '<label for="reportDetail">요청 설명 (선택)</label><textarea id="reportDetail" maxlength="200"></textarea><p class="report-status" role="status"></p><div class="dialog-actions"><button type="button" class="button cancel">취소</button><button type="submit" class="button primary">접수하기</button></div></form>';
    document.body.appendChild(dialog);
    dialog.addEventListener('close', function () {
      dialog.remove();
      if (button.isConnected) button.focus();
    });
    dialog.querySelector('.cancel').onclick = function () {
      dialog.close();
    };
    var pending = false;
    dialog.addEventListener('cancel', function (e) {
      if (pending) e.preventDefault();
    });
    dialog.querySelector('form').onsubmit = async function (ev) {
      ev.preventDefault();
      if (pending) return;
      pending = true;
      var send = dialog.querySelector('[type=submit]'),
        cancel = dialog.querySelector('.cancel');
      send.disabled = cancel.disabled = true;
      try {
        await ensureWriter();
        var result = await sb
          .from('reports')
          .insert({
            target_type: type,
            target_id: id,
            reason: dialog.querySelector('[name=reason]:checked').value,
            detail: dialog.querySelector('textarea').value.trim() || null,
            reporter_device: userId,
            author_id: userId,
          });
        if (result.error && result.error.code !== '23505') throw result.error;
        reported.add(type + id);
        button.textContent = '접수됨';
        button.disabled = true;
        dialog.close();
        status('요청을 접수했어요. 운영자가 확인합니다.');
      } catch (e) {
        dialog.querySelector('.report-status').textContent = '접수 실패 — ' + hint(e);
        send.disabled = cancel.disabled = false;
      } finally {
        pending = false;
      }
    };
    dialog.showModal();
  }
  function renderPreviews() {
    $('photoCount').textContent = photos.length + ' / 5장';
    $('photoPreviews').innerHTML = photos
      .map(function (p, i) {
        return (
          '<figure class="photo-preview"><img src="' +
          p.url +
          '" alt="첨부할 사진 ' +
          (i + 1) +
          '"><button type="button" data-remove-photo="' +
          i +
          '" aria-label="사진 ' +
          (i + 1) +
          ' 삭제">×</button><figcaption>' +
          Math.ceil(p.full.size / 1024) +
          'KB · ' +
          (i + 1) +
          '번 사진</figcaption></figure>'
        );
      })
      .join('');
  }
  function lockEditor(locked) {
    $('postForm')
      .querySelectorAll('input,textarea,select,[data-remove-photo]')
      .forEach(function (el) {
        el.disabled = locked;
      });
    $('btnTrace').disabled = busy || preparing;
    $('cancelWrite').disabled = busy || preparing || !!(attempt && attempt.uncertain);
  }
  async function clearAttempt() {
    if (!attempt) return;
    if (attempt.uncertain) throw new Error('‘글 남기기’를 다시 눌러 등록 여부를 먼저 확인해주세요.');
    var old = attempt;
    attempt = null;
    if (old.paths.length) {
      try {
        checked(
          await sb.storage.from('board-images').remove(
            old.paths.flatMap(function (p) {
              return [p, OrbitBoardMedia.thumbnail(p)];
            }),
          ),
        );
      } catch (e) {
        /* Private abandoned files are eligible for moderator cleanup after a day. */
      }
    }
  }
  async function submitPost(ev) {
    ev.preventDefault();
    if (busy || preparing) return;
    var text = $('postInput').value.trim(),
      title = OrbitBoardWriting.title(text, $('postTitle').value),
      observation = OrbitBoardWriting.collect($('postForm'));
    if (!text || text.length > 5000 || title.length > 80) {
      writeStatus(!text ? '이야기나 궁금한 점을 한 줄 남겨주세요.' : '제목은 80자, 이야기는 5,000자 이내로 적어주세요.', true);
      (!text || text.length > 5000 ? $('postInput') : $('postTitle')).focus();
      return;
    }
    if (Object.values(observation).some(function (value) { return value.length > 120; })) {
      writeStatus('추가 정보는 항목마다 120자 이내로 적어주세요.', true);
      return;
    }
    if (!prepareNickname()) return;
    var fingerprint = JSON.stringify([
      title,
      text,
      $('orbitSelect').value,
      $('postPinned').checked,
      observation,
      photos.map(function (p) {
        return p.url;
      }),
    ]);
    busy = true;
    lockEditor(true);
    writeStatus('등록을 준비하고 있어요…');
    try {
      await ensureWriter();
      if (Object.keys(observation).length) {
        var readiness = await sb.rpc('board_observation_version');
        if (readiness.error || readiness.data !== 1)
          throw new Error('추가 정보를 아직 저장할 수 없어요. 입력한 내용을 그대로 두고 잠시 후 다시 시도해주세요.');
      }
      if (attempt && attempt.fingerprint !== fingerprint) await clearAttempt();
      if (!attempt)
        attempt = {
          id: crypto.randomUUID(),
          fingerprint: fingerprint,
          paths: [],
          uploaded: new Set(),
          uncertain: false,
          payload: null,
        };
      if (photos.length && !attempt.paths.length)
        attempt.paths = checked(
          await sb.rpc('reserve_board_images', { p_post_id: attempt.id, p_count: photos.length }),
        );
      for (var i = 0; i < photos.length; i++) {
        writeStatus('사진 ' + (i + 1) + ' / ' + photos.length + '장을 올리고 있어요…');
        for (var entry of [
          [attempt.paths[i], photos[i].full],
          [OrbitBoardMedia.thumbnail(attempt.paths[i]), photos[i].thumb],
        ]) {
          if (attempt.uploaded.has(entry[0])) continue;
          var result = await sb.storage
            .from('board-images')
            .upload(entry[0], entry[1], {
              contentType: 'image/jpeg',
              upsert: false,
              cacheControl: '3600',
            });
          // A timed-out immutable upload can have succeeded. These random paths
          // belong only to this reservation and the same in-memory photo bytes.
          if (
            result.error &&
            String(result.error.statusCode) !== '409' &&
            !/already exists|Duplicate/i.test(result.error.message || '')
          )
            throw result.error;
          attempt.uploaded.add(entry[0]);
        }
      }
      attempt.payload = attempt.payload || {
        p_id: attempt.id,
        p_nick: nick(),
        p_title: title,
        p_orbit: $('orbitSelect').value,
        p_text: text,
        p_images: attempt.paths,
        p_pinned: isAdmin && $('postPinned').checked,
        ...(Object.keys(observation).length ? { p_observation: observation } : {}),
      };
      writeStatus('글을 등록하고 있어요…');
      attempt.uncertain = true;
      var saved = await sb.rpc(attempt.payload.p_observation ? 'create_observation_post' : 'create_board_post', attempt.payload);
      if (saved.error) {
        // Constraint/auth failures roll back; network/5xx errors can be a lost
        // response after commit. Keep the UUID and frozen payload for retry.
        if (saved.error.code && /^(22|23|42|P0001)/.test(saved.error.code))
          attempt.uncertain = false;
        throw saved.error;
      }
      var id = checked(saved);
      attempt = null;
      cache = null;
      $('postForm').reset();
      $('observationFields').open = $('equipmentFields').open = false;
      syncWriter();
      photos.forEach(function (p) {
        URL.revokeObjectURL(p.url);
      });
      photos = [];
      renderPreviews();
      $('charCount').textContent = '0 / 5,000';
      writeStatus('');
      busy = false;
      lockEditor(false);
      status('글을 등록했어요.');
      refreshActivity();
      navigate(url({ post: id }), true);
    } catch (e) {
      writeStatus(
        (attempt && attempt.uncertain
          ? '등록 여부를 확인하지 못했어요. 같은 글이 중복되지 않도록 ‘글 남기기’를 다시 눌러 확인해주세요. '
          : '등록 실패 — ') + hint(e),
        true,
      );
    } finally {
      busy = false;
      lockEditor(!!(attempt && attempt.uncertain));
    }
  }
  async function showRoute() {
    activityReader.reset();
    commentsLoaded = false;
    $('readSyncStatus').hidden = true;
    document.querySelectorAll('.glossary-dialog').forEach(function (dialog) { dialog.close(); });
    activeURL = location.href;
    var token = ++route;
    ++commentSeq;
    listBusy = false;
    detail = null;
    revokeImages();
    var params = new URLSearchParams(location.search),
      h = location.hash.slice(1);
    activity = activityScopes.some(function (s) { return s[0] === params.get('activity'); }) ? params.get('activity') : '';
    channel = channels.some(function (c) {
      return c[0] === h;
    })
      ? h
      : 'all';
    if (activity) channel = 'all';
    query = (params.get('q') || '').trim().slice(0, 80);
    var id = params.get('post');
    view = id ? 'detail' : params.has('write') ? 'editor' : 'list';
    ['list', 'detail', 'editor'].forEach(function (v) {
      $(v + 'View').hidden = v !== view;
    });
    document.title = 'Orbit | 별빛 게시판';
    activityHeading();
    if (activity && view === 'list') document.title = '내 활동 | Orbit';
    $('backToFeed').href = $('cancelWriteLink').href = url();
    $('writeTop').href = $('writeBottom').href = url({ write: true });
    window.scrollTo(0, 0);
    if (view === 'editor') {
      syncWriter();
      $('pinEditor').hidden = !isAdmin;
      if (!dirty()) $('orbitSelect').value = channel === 'all' ? 'free' : channel;
      $('postInput').focus({ preventScroll: true });
      return;
    }
    if (view === 'detail') {
      if (validId(id)) await loadDetail(id, token);
      else
        $('postDetail').innerHTML =
          '<div class="empty-state"><h1>글 주소가 올바르지 않아요</h1><p>목록에서 다시 찾아주세요.</p></div>';
      return;
    }
    syncFilters();
    refreshActivity();
    $('searchInput').value = query;
    $('clearSearch').hidden = !query;
    $('pageStatus').textContent = '';
    $('refreshList').disabled = false;
    if (cache && cache.key === activity + '|' + channel + '|' + query) {
      posts = cache.posts.slice();
      more = cache.more;
      $('pinnedPosts').innerHTML = cache.pins;
      $('pinnedPosts').hidden = !cache.pins;
      renderPosts();
      window.scrollTo(0, cache.scroll);
    } else {
      posts = [];
      more = false;
      $('pinnedPosts').replaceChildren();
      $('pinnedPosts').hidden = true;
      $('loadMore').hidden = true;
      $('writeBottom').hidden = true;
      await loadList(false);
    }
  }
  document.addEventListener('click', async function (ev) {
    var link = ev.target.closest(
      'a[data-board-nav],#writeTop,#writeBottom,#backToFeed,#cancelWriteLink',
    );
    if (link && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.button === 0) {
      ev.preventDefault();
      navigate(link.href);
      return;
    }
    var b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.report) {
      openReport(b.dataset.report, b.dataset.id, b);
      return;
    }
    if (b.dataset.emoji) {
      toggleReaction(b);
      return;
    }
    if (b.hasAttribute('data-remove-photo')) {
      if (busy || preparing || (attempt && attempt.uncertain)) return;
      await clearAttempt();
      URL.revokeObjectURL(photos[Number(b.dataset.removePhoto)].url);
      photos.splice(Number(b.dataset.removePhoto), 1);
      renderPreviews();
      return;
    }
    if (b.dataset.deleteComment) {
      if (!confirm('댓글을 삭제할까요? 되돌릴 수 없어요.')) return;
      b.disabled = true;
      try {
        await ensureWriter();
        var deleted = checked(
          await sb.from('comments').delete().eq('id', b.dataset.deleteComment).select('id'),
        );
        if (!deleted.length) throw new Error('삭제 권한을 확인하지 못했어요.');
        cache = null;
        await loadComments(false);
      } catch (e) {
        status('삭제 실패 — ' + hint(e), true);
        b.disabled = false;
      }
      return;
    }
    var action = b.dataset.action,
      p = detail;
    if (action === 'retry-list') {
      loadList(false);
      return;
    }
    if (action === 'retry-detail') {
      showRoute();
      return;
    }
    if (action === 'refresh-comments') {
      loadComments(false);
      return;
    }
    if (action === 'retry-reactions' && p) {
      loadReactions(p, route);
      return;
    }
    if (action === 'share' && p) {
      var share = new URL('lounge.html', location.href);
      share.searchParams.set('post', p.id);
      share.hash = p.orbit;
      try {
        await navigator.clipboard.writeText(share.href);
        status('글 주소를 복사했어요.');
      } catch (e) {
        var input = $('shareAddress');
        if (!input) {
          input = document.createElement('input');
          input.id = 'shareAddress';
          input.className = 'share-link';
          input.readOnly = true;
          input.setAttribute('aria-label', '공유할 글 주소');
          b.parentElement.appendChild(input);
        }
        input.value = share.href;
        input.focus();
        input.select();
      }
      return;
    }
    if (action === 'pin' && p) {
      b.disabled = true;
      try {
        await ensureWriter();
        var updated = checked(
          await sb.from('posts').update({ is_pinned: !p.is_pinned }).eq('id', p.id).select('id'),
        );
        if (!updated.length) throw new Error('관리자 권한을 확인하지 못했어요.');
        cache = null;
        p.is_pinned = !p.is_pinned;
        await showRoute();
        status(p.is_pinned ? '공지를 상단에 고정했어요.' : '공지 고정을 해제했어요.');
      } catch (e) {
        status(hint(e), true);
        b.disabled = false;
      }
      return;
    }
    if (action === 'delete-post' && p) {
      if (!confirm('글과 댓글을 삭제할까요? 되돌릴 수 없어요.')) return;
      b.disabled = true;
      try {
        await ensureWriter();
        var removed = checked(await sb.from('posts').delete().eq('id', p.id).select('id'));
        if (!removed.length) throw new Error('삭제 권한을 확인하지 못했어요.');
        cache = null;
        delete commentDrafts[p.id];
        var paths = (p.image_paths || []).flatMap(function (path) {
          return [path, OrbitBoardMedia.thumbnail(path)];
        });
        if (paths.length) await sb.storage.from('board-images').remove(paths);
        status('글을 삭제했어요.');
        navigate(url(), true);
      } catch (e) {
        status('삭제 실패 — ' + hint(e), true);
        b.disabled = false;
      }
    }
  });
  $('orbitSelect').innerHTML = channels
    .slice(1)
    .map(function (c) {
      return '<option value="' + c[0] + '">' + c[1] + '</option>';
    })
    .join('');
  $('postForm').addEventListener('submit', submitPost);
  $('writerNickname').addEventListener('input', function () {
    if (!busy) writeStatus('');
  });
  $('postInput').addEventListener('input', function () {
    $('charCount').textContent = this.value.length.toLocaleString('ko-KR') + ' / 5,000';
  });
  $('photoInput').addEventListener('change', async function () {
    var files = Array.from(this.files);
    this.value = '';
    if (busy || preparing || (attempt && attempt.uncertain)) return;
    if (photos.length + files.length > 5) {
      writeStatus('사진은 글당 5장까지 첨부할 수 있어요.', true);
      return;
    }
    preparing = true;
    lockEditor(true);
    writeStatus('사진을 준비하고 있어요…');
    try {
      await clearAttempt();
      for (var file of files) {
        photos.push(await OrbitBoardMedia.prepare(file));
        renderPreviews();
      }
      writeStatus('사진 준비가 끝났어요. ‘글 남기기’를 누르면 함께 올라갑니다.');
    } catch (e) {
      writeStatus(hint(e), true);
    } finally {
      preparing = false;
      lockEditor(false);
    }
  });
  $('cancelWrite').onclick = function () {
    navigate(url());
  };
  $('questionFilter').onchange = function () {
    var next = new URL(url(), location.href);
    next.hash = this.checked ? 'ask' : 'all';
    navigate(next.pathname + next.search + next.hash);
  };
  $('feedSearch').onsubmit = function (ev) {
    ev.preventDefault();
    if (!canLeave()) return;
    query = $('searchInput').value.trim().slice(0, 80);
    cache = null;
    history.pushState(null, '', url());
    showRoute();
  };
  $('clearSearch').onclick = function () {
    query = '';
    cache = null;
    history.pushState(null, '', url());
    showRoute();
  };
  $('refreshList').onclick = function () {
    cache = null;
    status('');
    loadList(false);
    refreshActivity();
  };
  $('activityRetry').onclick = function () { refreshActivity(); };
  $('readSyncRetry').onclick = function () { activityReader.retry(); };
  $('loadMore').onclick = function () {
    loadList(true);
  };
  window.addEventListener('popstate', function () {
    if (busy || preparing || commentBusy || (attempt && attempt.uncertain)) {
      history.pushState(null, '', activeURL);
      status('진행 중인 등록을 먼저 완료해주세요.', true);
      return;
    }
    showRoute();
  });
  window.addEventListener('hashchange', function () {
    if (view === 'list' && location.hash.slice(1) !== channel) showRoute();
  });
  window.addEventListener('beforeunload', function (ev) {
    if (
      dirty() ||
      busy ||
      commentBusy ||
      Object.values(commentDrafts).some(function (s) {
        return s.trim();
      })
    ) {
      ev.preventDefault();
      ev.returnValue = '';
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { activityReader.reset(); return; }
    if (Date.now() - summaryTime > 60000) refreshActivity();
    if (view === 'detail' && detail && commentsLoaded) activityReader.observe($('commentList'), detail.id, comments);
  });
  window.addEventListener('message', function (ev) {
    if (
      ev.origin !== location.origin ||
      ev.source !== parent ||
      !ev.data ||
      ev.data.orbit !== 'profileChanged'
    )
      return;
    if (view === 'editor') {
      syncWriter();
    }
  });
  if (embed) parent.postMessage({ orbit: 'loungeReady' }, location.origin);
  (async function () {
    try {
      if (sb) {
        var s = checked(await sb.auth.getSession());
        if (s.session) {
          userId = s.session.user.id;
          isAdmin = checked(await sb.rpc('is_admin')) === true;
        }
      }
    } catch (e) {
      /* Reading remains available if admin detection fails. */
    }
    if (!sb) {
      status('서버 연결을 준비하지 못했어요. 새로고침해주세요.', true);
      return;
    }
    await showRoute();
    sb.auth.onAuthStateChange(function (event, session) {
      var next = session && session.user && session.user.id || null;
      if (next === userId) return;
      var previous = userId;
      userId = next;
      isAdmin = false;
      if (previous || activity) cache = null;
      activityReader.reset();
      ++summarySeq;
      unreadThreads = 0;
      updateActivityLink();
      if (previous) {
        ++route;
        ++commentSeq;
        commentsLoaded = false;
        if (activity && view === 'list') { posts = []; $('postList').replaceChildren(); }
      }
      if (view === 'list') setTimeout(showRoute, 0);
    });
  })();
})();

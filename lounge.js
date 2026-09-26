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
    writerPromise = null,
    anonymousPromise = null,
    actorSeq = 0,
    actorIdentity = '',
    identityReady = false,
    identityTimer = null,
    anonymousViewsAllowed = true;
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
  var draftStore = OrbitBoardWriting.createDraftStore(), draftOwner = null, draftUser = null,
    draftBuffers = new Map(), draftTimer = null, draftStorageOK = true,
    draftSessionOK = true, draftMissingPhotos = false, draftResumeQueued = false;
  var draftSession = (function () {
    try {
      var saved = JSON.parse(sessionStorage.getItem('orbit_board_draft_session'));
      if (saved && validId(saved.id)) return saved;
    } catch (_) { draftSessionOK = false; }
    var fresh = { id: crypto.randomUUID() };
    try { sessionStorage.setItem('orbit_board_draft_session', JSON.stringify(fresh)); draftSessionOK = true; }
    catch (_) { draftSessionOK = false; }
    return fresh;
  })();
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
    $('boardTitle').textContent = activity ? '내 활동' : '자유게시판';
    $('boardTitle').href = activityURL(activity || '');
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
  function renderPostText(container, value) {
    var text = String(value == null ? '' : value),
      pattern = /https?:\/\/[^\s<>"'`\u2018\u2019\u201c\u201d\u3008-\u300f]+/gi,
      closing = { ')': '(', ']': '[', '}': '{' },
      fragment = document.createDocumentFragment(), previous = 0, match;
    while ((match = pattern.exec(text))) {
      var address = match[0];
      // Keep balanced URL brackets, but leave surrounding prose punctuation outside.
      while (address) {
        var last = address.slice(-1), opening = closing[last];
        if (/[.,!?;:，。！？、]/.test(last) ||
            (opening && address.split(last).length > address.split(opening).length)) {
          address = address.slice(0, -1);
        } else break;
      }
      var destination;
      try { destination = new URL(address); } catch (_) { continue; }
      if (!/^https?:$/.test(destination.protocol) || !destination.hostname) continue;
      var link = document.createElement('a');
      link.href = destination.href;
      link.textContent = address;
      link.target = '_blank';
      link.rel = 'noopener noreferrer ugc';
      link.title = '새 탭에서 열기';
      fragment.append(document.createTextNode(text.slice(previous, match.index)), link);
      previous = match.index + address.length;
    }
    fragment.appendChild(document.createTextNode(text.slice(previous)));
    container.replaceChildren(fragment);
  }
  function nick() {
    var profile = window.OrbitMembers.state.profile;
    if (profile) return profile.nickname;
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
    // Logging out must not silently start a new Auth operation behind login.
    if (!userId && !anonymousViewsAllowed) return;
    try {
      await ensureWriter(true);
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
  async function ensureWriter(passive) {
    if (writerPromise) return writerPromise;
    var token = actorSeq, actor = userId;
    var pending = (async function () {
      if (!sb) throw new Error('서버 연결을 준비하지 못했어요. 새로고침해주세요.');
      if (!boardReady) {
        var v = checked(await sb.rpc('board_version'));
        assertActor(token, actor);
        if (v !== 1) throw new Error('게시판 업데이트를 준비하고 있어요. 잠시 후 다시 시도해주세요.');
        boardReady = true;
      }
      var s = checked(await sb.auth.getSession());
      assertActor(token, actor);
      var user = s.session && s.session.user;
      if (!user) {
        if (passive && !anonymousViewsAllowed) throw actorChanged();
        var signing = sb.auth.signInAnonymously();
        anonymousPromise = signing;
        try { user = checked(await signing).user; }
        finally { if (anonymousPromise === signing) anonymousPromise = null; }
        // Our own first anonymous session is the sole allowed identity transition.
        if (!user || !user.is_anonymous || userId !== user.id) throw actorChanged();
      } else {
        assertActor(token, actor);
        if (user.id !== actor) throw actorChanged();
      }
      if (!user) throw new Error('작성 권한을 확인하지 못했어요.');
      return user.id;
    })();
    writerPromise = pending;
    try { return await pending; }
    finally { if (writerPromise === pending) writerPromise = null; }
  }
  function canWrite() {
    var state = window.OrbitMembers.state, user = state.user;
    return !!(user && user.id === userId && !user.is_anonymous && user.email_confirmed_at && state.profile && !state.error);
  }
  async function ensureAuthor() {
    var token = actorSeq, actor = userId;
    await window.OrbitMembers.refresh();
    assertActor(token, actor);
    if (!canWrite()) { join(); throw new Error('로그인하고 닉네임 설정을 마쳐주세요.'); }
    var id = await ensureWriter();
    assertActor(token, actor);
    var profile = checked(await sb.rpc('member_profile'));
    assertActor(token, actor);
    if (!profile) throw new Error('내 계정에서 닉네임 설정을 먼저 마쳐주세요.');
    try { localStorage.setItem('orbit_nickname', profile.nickname); } catch (_) {}
    return id;
  }
  function join() { window.OrbitAccount.open(); }
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
      Object.keys(OrbitBoardWriting.collect($('postForm'))).length;
  }
  function saveDraftSession() {
    try { sessionStorage.setItem('orbit_board_draft_session', JSON.stringify(draftSession)); draftSessionOK = true; }
    catch (_) { draftSessionOK = false; }
  }
  function validHandoff() {
    var handoff = draftSession.handoff;
    return handoff && typeof handoff.owner === 'string' &&
      handoff.owner.startsWith('guest:' + draftSession.id + ':') &&
      Number.isFinite(handoff.at) && handoff.at <= Date.now() && Date.now() - handoff.at < 30 * 60000;
  }
  function guestOwner() {
    var prefix = 'guest:' + draftSession.id + ':', saved = draftSession.guestOwner;
    if (typeof saved === 'string' && saved.startsWith(prefix) &&
        (saved === prefix + 'visitor' || validId(saved.slice(prefix.length)))) return saved;
    // Keep a tab's old anonymous-owned draft reachable after this upgrade. Never
    // copy over another row, and never re-key a guest just because Auth appears.
    var visitor = prefix + 'visitor', legacy = draftStore.latestGuest(draftSession.id);
    if (!legacy.ok) draftStorageOK = false;
    draftSession.guestOwner = readDraft(visitor) ? visitor : legacy.value ? legacy.value.owner : visitor;
    saveDraftSession();
    return draftSession.guestOwner;
  }
  function commentOwner() {
    return draftUser && !draftUser.is_anonymous ? 'member:' + draftUser.id : guestOwner();
  }
  function commentKey(id) { return commentOwner() + '|' + id; }
  function identityKey(user) { return user ? user.id + '|' + !!user.is_anonymous + '|' + !!user.email_confirmed_at : ''; }
  function sameActor(token, actor) { return token === actorSeq && actor === userId; }
  function actorChanged() { return new Error('계정이 바뀌었어요. 현재 계정에서 다시 시도해주세요.'); }
  function assertActor(token, actor) { if (!sameActor(token, actor)) throw actorChanged(); }
  function memberOwner() {
    return draftUser && !draftUser.is_anonymous && draftUser.email_confirmed_at ? 'member:' + draftUser.id : null;
  }
  function nextDraftOwner() {
    var member = memberOwner(), continuation = draftSession.continuation;
    if (member && continuation && typeof continuation.owner === 'string' &&
        continuation.owner.startsWith(member + ':continue:') &&
        validId(continuation.owner.slice((member + ':continue:').length)) &&
        Number.isFinite(continuation.at) && continuation.at <= Date.now() && Date.now() - continuation.at < 7 * 86400000 &&
        readDraft(continuation.owner)) return continuation.owner;
    if (member && (!draftOwner || !draftOwner.startsWith(member))) {
      var latest = draftStore.latestContinuation(member);
      if (!latest.ok) draftStorageOK = false;
      if (latest.value) {
        draftSession.continuation = { owner: latest.value.owner, at: latest.value.updatedAt };
        saveDraftSession();
        return latest.value.owner;
      }
    }
    return member || guestOwner();
  }
  function draftContent() {
    var row = { owner: draftOwner, updatedAt: Date.now(), title: $('postTitle').value,
      text: $('postInput').value, orbit: $('orbitSelect').value,
      observation: OrbitBoardWriting.collect($('postForm')), hasPhotos: !!photos.length || draftMissingPhotos };
    if (attempt && attempt.uncertain && attempt.payload)
      row.pending = { id: attempt.id, nick: attempt.payload.p_nick, images: attempt.payload.p_images.slice() };
    return row;
  }
  function hasDraft(row) {
    return !!row && (row.title.trim() || row.text.trim() || Object.keys(row.observation).length || row.hasPhotos || row.pending);
  }
  function draftNotice(message) {
    $('clearDraft').hidden = !dirty() && !draftMissingPhotos;
    $('clearDraft').disabled = busy || preparing || !!(attempt && attempt.uncertain);
    $('draftPhotoNotice').hidden = !photos.length && !draftMissingPhotos;
    if (message !== undefined) $('draftStatus').textContent = message;
  }
  function persistDraft() {
    clearTimeout(draftTimer);
    if (!draftOwner) return true;
    var row = draftContent();
    draftBuffers.set(draftOwner, { row: row, photos: photos, attempt: attempt });
    draftStorageOK = hasDraft(row) ? draftStore.write(row) : draftStore.remove(draftOwner);
    if (draftOwner.startsWith('guest:') && !draftSessionOK) draftStorageOK = false;
    draftNotice(draftStorageOK ? (hasDraft(row) ? '이 브라우저에 임시저장했어요.' : '') :
      '임시저장할 수 없어요. 입력은 유지되지만 이 화면을 닫으면 사라질 수 있어요.');
    return draftStorageOK;
  }
  function readDraft(owner) {
    if (draftBuffers.has(owner)) return draftBuffers.get(owner);
    var result = draftStore.read(owner);
    if (!result.ok) draftStorageOK = false;
    return result.value ? { row: result.value, photos: [], attempt: null } : null;
  }
  function fingerprint() {
    return JSON.stringify([OrbitBoardWriting.title($('postInput').value.trim(), $('postTitle').value),
      $('postInput').value.trim(), $('orbitSelect').value, OrbitBoardWriting.collect($('postForm')),
      photos.map(function (photo) { return photo.url; })]);
  }
  function restoreDraft(buffer) {
    $('postForm').reset();
    $('observationFields').open = $('equipmentFields').open = false;
    photos = buffer ? buffer.photos : [];
    attempt = buffer ? buffer.attempt : null;
    draftMissingPhotos = !!(buffer && buffer.row.hasPhotos && !photos.length);
    if (buffer) {
      var row = buffer.row;
      $('postTitle').value = row.title;
      $('postInput').value = row.text;
      $('orbitSelect').value = row.orbit;
      $('postForm').querySelectorAll('[data-observation]').forEach(function (input) {
        input.value = row.observation[input.dataset.observation] || '';
      });
      [$('observationFields'), $('equipmentFields')].forEach(function (section) {
        section.open = Array.from(section.querySelectorAll('[data-observation]')).some(function (input) { return !!input.value; });
      });
      if (!attempt && row.pending) {
        var payload = { p_id: row.pending.id, p_nick: row.pending.nick,
          p_title: OrbitBoardWriting.title(row.text.trim(), row.title), p_text: row.text.trim(),
          p_orbit: row.orbit, p_images: row.pending.images.slice(), p_pinned: false };
        if (Object.keys(row.observation).length) payload.p_observation = row.observation;
        attempt = { id: payload.p_id, fingerprint: fingerprint(), paths: payload.p_images.slice(),
          uploaded: new Set(), uncertain: true, payload: payload };
        // These files were uploaded before the interrupted publication; retry reuses them.
        draftMissingPhotos = false;
      }
    } else $('orbitSelect').value = channel === 'all' ? 'free' : channel;
    renderPreviews();
    $('charCount').textContent = $('postInput').value.length.toLocaleString('ko-KR') + ' / 5,000';
    lockEditor(!!(attempt && attempt.uncertain));
    draftNotice(!draftStorageOK ? '임시저장을 사용할 수 없어요. 이 화면에서는 계속 작성할 수 있어요.' :
      attempt && attempt.uncertain ? '등록 결과를 확인할 글이 있어요. 글 남기기를 눌러 같은 등록을 확인해주세요.' :
      buffer ? '저장된 초안을 불러왔어요.' : '');
  }
  function syncDraftOwner() {
    if (busy || preparing || (!draftOwner && view !== 'editor' && !validHandoff())) return;
    var next = nextDraftOwner(), handoff = validHandoff() && memberOwner() ? draftSession.handoff : null;
    if (handoff && typeof handoff.target === 'string' && handoff.target !== memberOwner() &&
        !handoff.target.startsWith(memberOwner() + ':continue:')) handoff = null;
    if (next === draftOwner && !handoff) return;
    var typedBeforeReady = !draftOwner && dirty() ? { row: draftContent(), photos: photos, attempt: attempt } : null;
    if (draftOwner) persistDraft();
    var buffer = typedBeforeReady, resumed = false;
    if (handoff) {
      var target = handoff.target;
      if (typeof target !== 'string' ||
          !(target === memberOwner() || (target.startsWith(memberOwner() + ':continue:') &&
            validId(target.slice((memberOwner() + ':continue:').length))))) target = null;
      buffer = target && readDraft(target) || buffer || readDraft(handoff.owner);
      if (buffer && hasDraft(buffer.row)) {
        var existing = readDraft(memberOwner());
        next = target || memberOwner();
        if (!target && existing && hasDraft(existing.row)) next += ':continue:' + crypto.randomUUID();
        if (next !== memberOwner()) draftSession.continuation = { owner: next, at: Date.now() };
        handoff.target = next;
        // Do not alias/mutate the source row: a quota failure must leave the
        // original guest draft and its explicit handoff available after reload.
        buffer = { row: Object.assign({}, buffer.row, { owner: next }), photos: buffer.photos, attempt: buffer.attempt };
        draftBuffers.set(next, buffer);
        if (draftStore.write(buffer.row)) {
          draftStore.remove(handoff.owner);
          draftBuffers.delete(handoff.owner);
          delete draftSession.handoff;
        } else draftStorageOK = false;
        resumed = true;
      } else delete draftSession.handoff;
      saveDraftSession();
    }
    draftOwner = next;
    if (buffer) buffer.row.owner = next;
    restoreDraft(buffer || readDraft(next));
    if (resumed) {
      draftNotice(draftStorageOK ? '로그인 전 작성한 초안을 이어왔어요. 내용을 확인하고 글 남기기를 눌러주세요.' :
        '로그인 전 초안은 이 화면에 있어요. 임시저장할 수 없으니 화면을 닫지 말고 내용을 복사해두세요.');
      if (view !== 'editor' && !draftResumeQueued) {
        draftResumeQueued = true;
        setTimeout(function () {
          draftResumeQueued = false;
          history.replaceState(null, '', url({ write: true }));
          showRoute();
        }, 0);
      }
    }
  }
  function beginDraftLogin() {
    anonymousViewsAllowed = false;
    if (window.cancelOrbitAnonymousAuth) window.cancelOrbitAnonymousAuth();
    persistDraft();
    // Opening login is the user's explicit handoff intent even after browsing
    // away from the editor. Only this tab's nonempty guest draft is eligible.
    var owner = !memberOwner() && guestOwner(), buffer = owner && readDraft(owner);
    if (buffer && hasDraft(buffer.row)) {
      draftSession.handoff = { owner: owner, at: Date.now() };
      saveDraftSession();
    }
    if (view === 'editor') writeStatus('작성한 글은 그대로 있어요. 로그인하고 닉네임 설정을 마친 뒤 글 남기기를 다시 눌러주세요.');
  }
  window.OrbitBoardAuth = {
    prepareAccount: async function () {
      // Wait for the SDK itself, not only fetch: a response already consumed
      // just before cancellation may still be saving/notifying its old session.
      beginDraftLogin();
      var pending = [writerPromise, anonymousPromise].filter(Boolean);
      await Promise.all(pending.map(function (request) { return request.catch(function () {}); }));
    },
  };
  function syncWriter() {
    syncDraftOwner();
    var allowed = canWrite(), profile = allowed ? window.OrbitMembers.state.profile : null;
    $('memberWriteGate').hidden = allowed;
    $('postForm').hidden = false;
    $('writerName').textContent = profile ? profile.nickname + ' 이름으로 남겨요.' : '';
    $('writerName').hidden = !profile;
    var comment = $('commentInput'), form = $('commentForm');
    if (comment && form) {
      comment.hidden = !allowed;
      comment.disabled = !allowed || commentBusy;
      var button = form.querySelector('button');
      button.type = allowed ? 'submit' : 'button';
      button.textContent = allowed ? '등록' : '로그인하고 댓글 쓰기';
      if (allowed) delete button.dataset.accountOpen;
      else button.dataset.accountOpen = 'login';
    }
  }
  window.addEventListener('orbit:member', function () {
    var user = window.OrbitMembers.state.user;
    // In an iframe, the parent's profileChanged refresh can observe the new
    // session before the SDK broadcast arrives. Reconcile both event paths.
    // Members invalidates old refreshes synchronously on an Auth transition.
    if (identityKey(user) !== actorIdentity) { syncIdentity(user); return; }
    draftUser = user;
    syncWriter();
  });
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
        scroll: OrbitBoardEmbed.scrollY(),
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
              '<span data-member-id="' + esc(p.author_id || '') + '">' + esc(p.nick) + '</span>' +
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
        '<span data-member-id="' + esc(p.author_id || '') + '">' + esc(p.nick) + '</span>' +
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
      renderPostText($('postDetail').querySelector('.detail-body'), p.text);
      OrbitBoardWriting.render($('observationRecord'), p.observation);
      if (window.OrbitBoardGlossary) {
        var termCount = OrbitBoardGlossary.annotate([
          $('postDetail').querySelector('.detail-body'),
          ...$('observationRecord').querySelectorAll('dd'),
        ]);
        $('glossaryHelp').hidden = termCount === 0;
      }
      var draftKey = commentKey(p.id);
      $('commentInput').value = commentDrafts[draftKey] || '';
      $('commentInput').addEventListener('input', function () {
        commentDrafts[draftKey] = this.value;
      });
      $('commentForm').addEventListener('submit', submitComment);
      syncWriter();
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
            '<span data-member-id="' + esc(c.author_id || '') + '">' + esc(c.nick) + '</span>' +
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
    if (!canWrite()) { join(); return; }
    var input = $('commentInput'), text = input.value.trim(), p = detail,
      token = route, identity = actorSeq, actor = userId, key = commentKey(p.id);
    if (!text) return;
    commentBusy = true;
    var button = $('commentForm').querySelector('button');
    button.disabled = input.disabled = true;
    try {
      await ensureAuthor();
      assertActor(identity, actor);
      var pending = commentAttempts[key], alreadySaved = false;
      if (pending && pending.text === text) {
        var existing = checked(await sb.from('comments').select('id,post_id,text,author_id')
          .eq('id', pending.id).maybeSingle());
        assertActor(identity, actor);
        alreadySaved = !!(existing && existing.post_id === p.id && existing.author_id === actor && existing.text === text);
      } else pending = commentAttempts[key] = { id: crypto.randomUUID(), text: text };
      assertActor(identity, actor);
      if (!alreadySaved) checked(await sb.from('comments').insert({
        id: pending.id, post_id: p.id, nick: nick(), text: text,
        author_id: actor, author_device: actor,
      }));
      // A late success retains its UUID/text until that account explicitly
      // retries. Clearing it while a restored textarea survives would make the
      // next click allocate a new UUID and duplicate the already saved comment.
      if (token !== route || !sameActor(identity, actor)) return;
      if (commentAttempts[key] === pending) delete commentAttempts[key];
      if (commentDrafts[key] && commentDrafts[key].trim() === text) delete commentDrafts[key];
      cache = null;
      input.value = '';
      status('댓글을 등록했어요.');
      refreshActivity();
      await loadComments(false);
    } catch (e) {
      if (token === route && sameActor(identity, actor)) status('댓글 등록 실패 — ' + hint(e), true);
    } finally {
      if (sameActor(identity, actor)) {
        commentBusy = false;
        if (button.isConnected) { button.disabled = false; input.disabled = !canWrite(); }
        syncWriter();
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
      token = route, identity = actorSeq, actor = userId,
      emoji = button.dataset.emoji,
      on = button.getAttribute('aria-pressed') !== 'true';
    $('reactionRow')
      .querySelectorAll('button')
      .forEach(function (b) {
        b.disabled = true;
      });
    try {
      await ensureWriter();
      // Anonymous creation may rebuild the reading view; require a fresh click.
      assertActor(identity, actor);
      checked(await sb.rpc('set_reaction', { p_post_id: p.id, p_emoji: emoji, p_selected: on }));
      if (sameActor(identity, actor) && detail && detail.id === p.id) await loadReactions(detail, route);
    } catch (e) {
      if (token === route && sameActor(identity, actor)) {
        status('공감 저장 실패 — ' + hint(e), true);
        await loadReactions(p, token);
      }
    } finally {
      if (sameActor(identity, actor)) reactionBusy = false;
    }
  }
  function openReport(type, id, button) {
    var identity = actorSeq, actor = userId, reportKey = commentOwner() + '|' + type + id;
    if (reported.has(reportKey)) return;
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
        assertActor(identity, actor);
        var result = await sb
          .from('reports')
          .insert({
            target_type: type,
            target_id: id,
            reason: dialog.querySelector('[name=reason]:checked').value,
            detail: dialog.querySelector('textarea').value.trim() || null,
            reporter_device: actor,
            author_id: actor,
          });
        if (result.error && result.error.code !== '23505') throw result.error;
        reported.add(reportKey);
        if (!sameActor(identity, actor) || !dialog.isConnected) return;
        button.textContent = '접수됨';
        button.disabled = true;
        dialog.close();
        status('요청을 접수했어요. 운영자가 확인합니다.');
      } catch (e) {
        if (!sameActor(identity, actor) || !dialog.isConnected) return;
        dialog.querySelector('.report-status').textContent = '접수 실패 — ' + hint(e);
        send.disabled = cancel.disabled = false;
      } finally {
        pending = false;
      }
    };
    if (window.OrbitBoardEmbed) OrbitBoardEmbed.prepareDialog(dialog);
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
    $('clearDraft').disabled = busy || preparing || !!(attempt && attempt.uncertain);
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
    if (!canWrite()) { beginDraftLogin(); join(); return; }
    var postFingerprint = fingerprint(), postingOwner = draftOwner,
      identity = actorSeq, actor = userId, postingPhotos = photos, postingAttempt = attempt,
      postOrbit = $('orbitSelect').value;
    busy = true;
    lockEditor(true);
    writeStatus('등록을 준비하고 있어요…');
    try {
      await ensureAuthor();
      assertActor(identity, actor);
      if (memberOwner() !== 'member:' + actor || !postingOwner ||
          !postingOwner.startsWith('member:' + actor) || draftOwner !== postingOwner) throw actorChanged();
      if (Object.keys(observation).length) {
        var readiness = await sb.rpc('board_observation_version');
        assertActor(identity, actor);
        if (readiness.error || readiness.data !== 1)
          throw new Error('추가 정보를 아직 저장할 수 없어요. 입력한 내용을 그대로 두고 잠시 후 다시 시도해주세요.');
      }
      if (postingAttempt && postingAttempt.fingerprint !== postFingerprint) {
        await clearAttempt();
        assertActor(identity, actor);
        postingAttempt = null;
      }
      if (!postingAttempt) postingAttempt = attempt = {
        id: crypto.randomUUID(), fingerprint: postFingerprint, paths: [],
        uploaded: new Set(), uncertain: false, payload: null,
      };
      if (postingPhotos.length && !postingAttempt.paths.length) {
        var paths = checked(await sb.rpc('reserve_board_images', { p_post_id: postingAttempt.id, p_count: postingPhotos.length }));
        // Keep a completed reservation with A's retry buffer, even if B is now visible.
        postingAttempt.paths = paths;
        assertActor(identity, actor);
      }
      for (var i = 0; i < postingPhotos.length; i++) {
        assertActor(identity, actor);
        writeStatus('사진 ' + (i + 1) + ' / ' + postingPhotos.length + '장을 올리고 있어요…');
        for (var entry of [
          [postingAttempt.paths[i], postingPhotos[i].full],
          [OrbitBoardMedia.thumbnail(postingAttempt.paths[i]), postingPhotos[i].thumb],
        ]) {
          if (postingAttempt.uploaded.has(entry[0])) continue;
          assertActor(identity, actor);
          var result = await sb.storage.from('board-images').upload(entry[0], entry[1], {
            contentType: 'image/jpeg', upsert: false, cacheControl: '3600',
          });
          if (result.error && String(result.error.statusCode) !== '409' &&
              !/already exists|Duplicate/i.test(result.error.message || '')) throw result.error;
          postingAttempt.uploaded.add(entry[0]);
          assertActor(identity, actor);
        }
      }
      assertActor(identity, actor);
      postingAttempt.payload = postingAttempt.payload || {
        p_id: postingAttempt.id, p_nick: nick(), p_title: title, p_orbit: postOrbit,
        p_text: text, p_images: postingAttempt.paths, p_pinned: false,
        ...(Object.keys(observation).length ? { p_observation: observation } : {}),
      };
      writeStatus('글을 등록하고 있어요…');
      postingAttempt.uncertain = true;
      persistDraft();
      var saved = await sb.rpc(postingAttempt.payload.p_observation ? 'create_observation_post' : 'create_board_post', postingAttempt.payload);
      if (saved.error) {
        // Keep the UUID/frozen payload for an uncertain commit, owned only by A.
        if (saved.error.code && /^(22|23|42|P0001)/.test(saved.error.code)) postingAttempt.uncertain = false;
        throw saved.error;
      }
      var id = checked(saved);
      // Keep a stale success as the same uncertain UUID until its owner retries.
      // Another account (or a restored A editor) must not lose its draft record.
      if (!sameActor(identity, actor)) return;
      var owned = draftBuffers.get(postingOwner);
      if (owned && owned.attempt === postingAttempt) {
        draftStore.remove(postingOwner);
        draftBuffers.delete(postingOwner);
      }
      if (draftSession.continuation && draftSession.continuation.owner === postingOwner) {
        delete draftSession.continuation;
        saveDraftSession();
      }
      attempt = null;
      draftOwner = null;
      draftMissingPhotos = false;
      clearTimeout(draftTimer);
      cache = null;
      $('postForm').reset();
      $('observationFields').open = $('equipmentFields').open = false;
      postingPhotos.forEach(function (p) { URL.revokeObjectURL(p.url); });
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
      if (sameActor(identity, actor)) writeStatus(
        (postingAttempt && postingAttempt.uncertain
          ? '등록 여부를 확인하지 못했어요. 같은 글이 중복되지 않도록 ‘글 남기기’를 다시 눌러 확인해주세요. '
          : '등록 실패 — ') + hint(e), true);
    } finally {
      if (sameActor(identity, actor)) {
        busy = false;
        lockEditor(!!(attempt && attempt.uncertain));
        if (draftOwner) persistDraft();
        syncWriter();
      }
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
    if (embed) parent.postMessage({ orbit: 'writingState', writing: view === 'editor' }, location.origin);
    ['list', 'detail', 'editor'].forEach(function (v) {
      $(v + 'View').hidden = v !== view;
    });
    document.title = 'Orbit | 자유게시판';
    activityHeading();
    if (activity && view === 'list') document.title = '내 활동 | Orbit';
    $('backToFeed').href = $('cancelWriteLink').href = url();
    $('writeTop').href = $('writeBottom').href = url({ write: true });
    OrbitBoardEmbed.scrollTo(0);
    if (view === 'editor') {
      syncWriter();
      if (!dirty()) $('orbitSelect').value = channel === 'all' ? 'free' : channel;
      var focusBeforeRefresh = document.activeElement;
      await window.OrbitMembers.refresh();
      if (token !== route || view !== 'editor') return;
      syncWriter();
      // A slow identity check must not redirect keystrokes from a field the
      // writer has already selected, or focus an editor after navigating away.
      if (document.activeElement === focusBeforeRefresh && !$('postForm').contains(document.activeElement))
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
      OrbitBoardEmbed.scrollTo(cache.scroll);
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
    var actionIdentity = actorSeq, actionActor = userId, actionRoute = route, actionOwner = draftOwner;
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
      if (!sameActor(actionIdentity, actionActor) || draftOwner !== actionOwner) return;
      URL.revokeObjectURL(photos[Number(b.dataset.removePhoto)].url);
      photos.splice(Number(b.dataset.removePhoto), 1);
      renderPreviews();
      persistDraft();
      return;
    }
    if (b.dataset.deleteComment) {
      if (!confirm('댓글을 삭제할까요? 되돌릴 수 없어요.')) return;
      b.disabled = true;
      try {
        await ensureWriter();
        assertActor(actionIdentity, actionActor);
        var deleted = checked(
          await sb.from('comments').delete().eq('id', b.dataset.deleteComment).select('id'),
        );
        if (!deleted.length) throw new Error('삭제 권한을 확인하지 못했어요.');
        if (!sameActor(actionIdentity, actionActor) || actionRoute !== route) return;
        cache = null;
        await loadComments(false);
      } catch (e) {
        if (!sameActor(actionIdentity, actionActor) || actionRoute !== route) return;
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
        assertActor(actionIdentity, actionActor);
        var updated = checked(
          await sb.from('posts').update({ is_pinned: !p.is_pinned }).eq('id', p.id).select('id'),
        );
        if (!updated.length) throw new Error('관리자 권한을 확인하지 못했어요.');
        if (!sameActor(actionIdentity, actionActor) || actionRoute !== route) return;
        cache = null;
        p.is_pinned = !p.is_pinned;
        await showRoute();
        if (!sameActor(actionIdentity, actionActor)) return;
        status(p.is_pinned ? '공지를 상단에 고정했어요.' : '공지 고정을 해제했어요.');
      } catch (e) {
        if (!sameActor(actionIdentity, actionActor) || actionRoute !== route) return;
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
        assertActor(actionIdentity, actionActor);
        var removed = checked(await sb.from('posts').delete().eq('id', p.id).select('id'));
        if (!removed.length) throw new Error('삭제 권한을 확인하지 못했어요.');
        if (!sameActor(actionIdentity, actionActor) || actionRoute !== route) return;
        cache = null;
        delete commentDrafts[commentKey(p.id)];
        delete commentAttempts[commentKey(p.id)];
        var paths = (p.image_paths || []).flatMap(function (path) {
          return [path, OrbitBoardMedia.thumbnail(path)];
        });
        if (paths.length) await sb.storage.from('board-images').remove(paths);
        if (!sameActor(actionIdentity, actionActor) || actionRoute !== route) return;
        status('글을 삭제했어요.');
        navigate(url(), true);
      } catch (e) {
        if (!sameActor(actionIdentity, actionActor) || actionRoute !== route) return;
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
  $('postForm').addEventListener('input', function () {
    if (busy || preparing || (attempt && attempt.uncertain)) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(persistDraft, 250);
    draftNotice();
  });
  $('postForm').addEventListener('change', function () { if (!busy && !preparing) persistDraft(); });
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-account-open]')) beginDraftLogin();
  }, true);
  $('clearDraft').onclick = async function () {
    if (busy || preparing || (attempt && attempt.uncertain)) return;
    if (!confirm('이 브라우저의 현재 초안과 첨부한 사진 선택을 지울까요?')) return;
    var identity = actorSeq, actor = userId, owner = draftOwner;
    busy = true;
    lockEditor(true);
    await clearAttempt();
    if (!sameActor(identity, actor) || owner !== draftOwner) return;
    clearTimeout(draftTimer);
    var oldOwner = draftOwner, removed = draftStore.remove(oldOwner), previousDraft = null;
    draftBuffers.delete(oldOwner);
    photos.forEach(function (photo) { URL.revokeObjectURL(photo.url); });
    if (draftSession.continuation && draftSession.continuation.owner === oldOwner) {
      delete draftSession.continuation;
      saveDraftSession();
      draftOwner = nextDraftOwner();
      previousDraft = readDraft(draftOwner);
      restoreDraft(previousDraft);
    } else restoreDraft(null);
    busy = false;
    lockEditor(!!(attempt && attempt.uncertain));
    syncWriter();
    draftNotice(removed ? (previousDraft ? '현재 임시저장을 지우고 이전 초안을 불러왔어요.' : '현재 임시저장을 지웠어요.') :
      '화면은 비웠지만 저장된 초안을 지우지 못했어요. 브라우저의 사이트 데이터를 지워주세요.');
    writeStatus('');
  };
  $('postInput').addEventListener('input', function () {
    $('charCount').textContent = this.value.length.toLocaleString('ko-KR') + ' / 5,000';
  });
  $('photoInput').addEventListener('change', async function () {
    var files = Array.from(this.files);
    this.value = '';
    if (busy || preparing || (attempt && attempt.uncertain)) return;
    if (photos.length + files.length > 5) { writeStatus('사진은 글당 5장까지 첨부할 수 있어요.', true); return; }
    var identity = actorSeq, actor = userId, owner = draftOwner, selectedPhotos = photos;
    preparing = true;
    lockEditor(true);
    writeStatus('사진을 준비하고 있어요…');
    try {
      await clearAttempt();
      assertActor(identity, actor);
      for (var file of files) {
        var photo = await OrbitBoardMedia.prepare(file);
        if (!sameActor(identity, actor) || owner !== draftOwner) {
          // The text draft and already selected photos remain with the old owner.
          // A decode finishing after a switch must never become B's attachment.
          URL.revokeObjectURL(photo.url);
          return;
        }
        selectedPhotos.push(photo);
        draftMissingPhotos = false;
        renderPreviews();
      }
      writeStatus('사진 준비가 끝났어요. ‘글 남기기’를 누르면 함께 올라갑니다.');
    } catch (e) { if (sameActor(identity, actor)) writeStatus(hint(e), true); }
    finally {
      if (sameActor(identity, actor)) {
        preparing = false;
        lockEditor(false);
        persistDraft();
        syncWriter();
      }
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
    persistDraft();
    if (
      (dirty() && (!draftStorageOK || !!photos.length)) ||
      (attempt && attempt.uncertain) ||
      busy ||
      commentBusy ||
      Object.keys(commentDrafts).some(function (key) {
        return key.startsWith(commentOwner() + '|') && commentDrafts[key].trim();
      })
    ) {
      ev.preventDefault();
      ev.returnValue = '';
    }
  });
  window.addEventListener('pagehide', persistDraft);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { activityReader.reset(); return; }
    if (Date.now() - summaryTime > 60000) refreshActivity();
    if (view === 'detail' && detail && commentsLoaded) activityReader.observe($('commentList'), detail.id, comments);
  });
  window.addEventListener('message', function (ev) {
    if (ev.origin === location.origin && ev.source === parent && ev.data &&
        ev.data.orbit === 'accountOpening') {
      beginDraftLogin();
      return;
    }
    if (
      ev.origin !== location.origin ||
      ev.source !== parent ||
      !ev.data ||
      ev.data.orbit !== 'profileChanged'
    )
      return;
    window.OrbitMembers.refresh().then(syncWriter);
  });
  function syncIdentity(user) {
    var next = user && user.id || null;
    if (identityReady && identityKey(user) === actorIdentity) { draftUser = user; syncWriter(); return; }
    if (draftOwner) persistDraft();
    identityReady = true;
    actorIdentity = identityKey(user);
    if (user && !user.is_anonymous) {
      anonymousViewsAllowed = false;
      if (window.cancelOrbitAnonymousAuth) window.cancelOrbitAnonymousAuth();
    }
    userId = next;
    draftUser = user;
    ++actorSeq;
    writerPromise = null;
    isAdmin = false;
    cache = null;
    busy = preparing = commentBusy = reactionBusy = false;
    activityReader.reset();
    ++summarySeq;
    ++route;
    ++commentSeq;
    commentsLoaded = false;
    unreadThreads = 0;
    updateActivityLink();
    $('activityStatus').hidden = $('readSyncStatus').hidden = true;
    status('');
    writeStatus('');
    // Remove former-account text and privileged controls before awaiting any
    // new network response, including a stalled is_admin/member request.
    document.querySelectorAll('.board-dialog').forEach(function (dialog) { dialog.close(); });
    detail = null;
    comments = [];
    revokeImages();
    if (view === 'detail') $('postDetail').innerHTML = '<p class="empty-state">계정 정보를 확인하고 있어요…</p>';
    if (activity && view === 'list') { posts = []; $('postList').replaceChildren(); }
    syncWriter();
    lockEditor(!!(attempt && attempt.uncertain));
    clearTimeout(identityTimer);
    var token = actorSeq, actor = userId;
    identityTimer = setTimeout(async function () {
      if (!sameActor(token, actor)) return;
      // Public reading and profile readiness never wait for the role lookup.
      if (view !== 'editor') showRoute();
      window.OrbitMembers.refresh().then(function () { if (sameActor(token, actor)) syncWriter(); });
      try { if (actor) {
        var admin = checked(await sb.rpc('is_admin')) === true;
        if (!sameActor(token, actor)) return;
        if (isAdmin !== admin) {
          isAdmin = admin;
          if (view === 'detail' && detail) showRoute();
        }
      } } catch (_) { /* Failed role lookup cannot grant controls. */ }
    }, 0);
  }
  if (embed) parent.postMessage({ orbit: 'loungeReady' }, location.origin);
  if (sb) sb.auth.onAuthStateChange(function (event, session) {
    syncIdentity(session && session.user || null);
  });
  (async function () {
    if (!sb) {
      status('서버 연결을 준비하지 못했어요. 새로고침해주세요.', true);
      return;
    }
    var token = actorSeq;
    try {
      var s = checked(await sb.auth.getSession());
      if (token === actorSeq) syncIdentity(s.session && s.session.user || null);
    } catch (_) { if (!identityReady) syncIdentity(null); }
    // OAuth returns to the parent board panel, whose iframe normally opens its list.
    // Only this tab's explicit login handoff can reopen its writing screen.
    if (validHandoff() && memberOwner()) {
      var returningDraft = readDraft(draftSession.handoff.owner);
      if (returningDraft && hasDraft(returningDraft.row)) history.replaceState(null, '', url({ write: true }));
    }
    await showRoute();
  })();
})();

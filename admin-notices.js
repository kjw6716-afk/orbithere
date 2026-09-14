(function () {
  'use strict';
  // Authentication is checked here for the UI and by the existing database
  // trigger/RLS for every write, including forged direct API calls.
  window.createOrbitNotices = function (sb) {
    var panel = document.getElementById('noticePanel');
    var form = document.getElementById('noticeForm');
    var list = document.getElementById('noticeList');
    var status = document.getElementById('noticeStatus');
    var submit = document.getElementById('publishNotice');
    var title = document.getElementById('noticeTitle');
    var body = document.getElementById('noticeBody');
    var authorized = false, generation = 0, loadSequence = 0, busy = false, attempt = null;
    function message(error) {
      if (/orbit_pin_limit/.test(error.message || '')) return '상단 공지는 최대 3개예요. 기존 공지를 해제한 뒤 다시 등록해주세요.';
      if (/orbit_not_admin|42501|permission/i.test((error.code || '') + ' ' + (error.message || ''))) return '운영자 로그인을 다시 확인해주세요.';
      if (/orbit_rate_limit|rate.limit/i.test(error.message || '')) return '잠시 뒤 다시 시도해주세요.';
      return '처리 결과를 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.';
    }
    async function load() {
      if (!authorized) return;
      var token = generation;
      var request = ++loadSequence;
      list.textContent = '공지를 불러오는 중…';
      try {
        var result = await sb.rpc('board_posts', { p_pinned: true, p_limit: 3 });
        if (!authorized || token !== generation || request !== loadSequence) return;
        if (result.error) throw result.error;
        list.replaceChildren();
        if (!result.data.length) list.textContent = '상단에 고정된 공지가 없어요.';
        result.data.forEach(function (post) {
          var row = document.createElement('div');
          row.className = 'notice-row';
          var link = document.createElement('a');
          link.href = 'lounge.html?post=' + encodeURIComponent(post.id) + '#all';
          link.textContent = post.title;
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn-line';
          button.textContent = '고정 해제';
          button.addEventListener('click', async function () {
            if (!authorized || button.disabled) return;
            button.disabled = true;
            try {
              var result = await sb.from('posts').update({ is_pinned: false }).eq('id', post.id).select('id');
              if (!authorized || token !== generation) return;
              if (result.error) throw result.error;
              if (!result.data.length) throw new Error('permission denied');
              status.textContent = '고정을 해제했어요. 글은 자유게시판에 남아 있습니다.';
              await load();
            } catch (error) {
              if (authorized && token === generation) status.textContent = message(error);
            } finally { button.disabled = false; }
          });
          row.append(link, button);
          list.append(row);
        });
      } catch (error) {
        if (authorized && token === generation && request === loadSequence) list.textContent = '공지 목록을 불러오지 못했어요. 새로고침으로 다시 확인해주세요.';
      }
    }
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!authorized || busy || !form.reportValidity()) return;
      if (!title.value.trim() || !body.value.trim()) { status.textContent = '제목과 내용을 입력해주세요.'; return; }
      busy = true;
      var token = generation;
      submit.disabled = true;
      title.readOnly = body.readOnly = true;
      attempt = attempt || { p_id: crypto.randomUUID(), p_nick: '운영자', p_title: title.value.trim(), p_orbit: 'free', p_text: body.value.trim(), p_images: [], p_pinned: true };
      status.textContent = '공지를 등록하고 있어요…';
      try {
        // Retrying an uncertain response reuses the UUID and literal payload.
        var result = await sb.rpc('create_board_post', attempt);
        if (!authorized || token !== generation) return;
        if (result.error) {
          if (result.error.code && /^(22|23|42|P0001)/.test(result.error.code)) attempt = null;
          throw result.error;
        }
        attempt = null;
        form.reset();
        status.textContent = '공지를 등록하고 자유게시판 상단에 고정했어요.';
        await load();
      } catch (error) {
        if (authorized && token === generation) status.textContent = message(error) + (attempt ? ' 같은 내용으로 재시도하면 중복 등록되지 않아요.' : '');
      } finally {
        if (token === generation) {
          busy = false;
          submit.disabled = !authorized;
          title.readOnly = body.readOnly = !!attempt;
        }
      }
    });
    document.getElementById('refreshNotices').addEventListener('click', load);
    return {
      setAuthorized: function (value) {
        authorized = value === true;
        generation++;
        panel.hidden = !authorized;
        busy = false;
        attempt = null;
        submit.disabled = !authorized;
        title.readOnly = body.readOnly = false;
        form.reset();
        list.replaceChildren();
        status.textContent = '';
        if (authorized) load();
      },
    };
  };
})();

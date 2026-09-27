(function () {
  'use strict';
  var fields = [
    ['method', '관측 방법'], ['observed_at', '관측 시각'], ['location', '관측 장소'],
    ['target', '관측 대상'], ['direction', '바라본 방향'], ['telescope', '망원경 본체 · 경통'],
    ['mount', '망원경 받침 · 가대'], ['camera', '카메라'], ['filter', '필터'],
    ['exposure', '노출 시간 · 촬영 장수'], ['processing', '사진 보정 프로그램'],
  ];
  var methods = { 'naked-eye': '맨눈', phone: '휴대폰', binoculars: '쌍안경', telescope: '망원경' };
  function collect(form) {
    var record = {};
    fields.forEach(function (field) {
      var input = form.querySelector('[data-observation="' + field[0] + '"]');
      if (input && input.value.trim()) record[field[0]] = input.value.trim();
    });
    return record;
  }
  function title(text, manual) {
    if (manual.trim()) return manual.trim();
    var first = text.trim().split(/\r?\n/)[0].match(/^.*?[.!?。！？](?=\s|$)/);
    var line = first ? first[0] : text.trim().split(/\r?\n/)[0];
    // Match the input's UTF-16 limit without cutting an emoji surrogate pair.
    var result = line.slice(0, 80);
    if (/[\uD800-\uDBFF]$/.test(result)) result = result.slice(0, -1);
    return result;
  }
  function render(container, record) {
    container.replaceChildren();
    if (!record || typeof record !== 'object' || Array.isArray(record)) return;
    function section(keys, heading, folded) {
      var rows = fields.filter(function (field) {
        return keys.includes(field[0]) && typeof record[field[0]] === 'string' && record[field[0]].trim();
      });
      if (!rows.length) return;
      var wrapper = document.createElement(folded ? 'details' : 'section');
      wrapper.className = 'observation-record' + (folded ? ' observation-record-gear' : '');
      var label = document.createElement(folded ? 'summary' : 'h2');
      label.textContent = heading;
      wrapper.appendChild(label);
      var list = document.createElement('dl');
      rows.forEach(function (field) {
        var row = document.createElement('div'), key = document.createElement('dt'), value = document.createElement('dd');
        key.textContent = field[1];
        value.textContent = field[0] === 'method' ? methods[record.method] || record.method : record[field[0]];
        row.append(key, value);
        list.appendChild(row);
      });
      wrapper.appendChild(list);
      container.appendChild(wrapper);
    }
    section(['method', 'observed_at', 'location', 'target', 'direction'], '함께 남긴 관측 정보', false);
    section(['telescope', 'mount', 'camera', 'filter', 'exposure', 'processing'], '장비·촬영 정보 보기', true);
  }
  // Only plain text and completed-upload references enter browser storage.
  // Drafts belong to one account or one guest tab, never to the next signed-in user.
  function createDraftStore() {
    var key = 'orbit_board_drafts_v1', age = 7 * 24 * 60 * 60 * 1000;
    var uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
    var ownerPattern = new RegExp('^(member:' + uuid + '(:continue:' + uuid + ')?|guest:' + uuid + ':(' + uuid + '|visitor))$', 'i');
    var idPattern = new RegExp('^' + uuid + '$', 'i');
    var orbits = ['report', 'gear', 'live', 'ask', 'free'];
    function clean(row) {
      if (!row || typeof row !== 'object' || !ownerPattern.test(row.owner || '') ||
          !Number.isFinite(row.updatedAt) || row.updatedAt > Date.now() + 60000 ||
          Date.now() - row.updatedAt >= age ||
          typeof row.title !== 'string' || row.title.length > 80 ||
          typeof row.text !== 'string' || row.text.length > 5000 || !orbits.includes(row.orbit) ||
          !row.observation || typeof row.observation !== 'object' || Array.isArray(row.observation)) return null;
      var observation = {};
      for (var field of fields) {
        var value = row.observation[field[0]];
        if (value === undefined) continue;
        if (typeof value !== 'string' || value.length > 120 ||
            (field[0] === 'method' && value && !Object.hasOwn(methods, value))) return null;
        if (value.trim()) observation[field[0]] = value;
      }
      var result = { owner: row.owner, updatedAt: row.updatedAt, title: row.title, text: row.text,
        orbit: row.orbit, observation: observation, hasPhotos: row.hasPhotos === true };
      if (row.pending != null) {
        var pending = row.pending, actor = row.owner.split(':')[1];
        if (!row.owner.startsWith('member:') || !pending || !idPattern.test(pending.id || '') ||
            typeof pending.nick !== 'string' || pending.nick.length < 2 || pending.nick.length > 12 ||
            !Array.isArray(pending.images) || pending.images.length > 5 ||
            !row.text.trim() || !pending.images.every(function (path) {
              return typeof path === 'string' && new RegExp('^' + actor + '/' + pending.id + '/' + uuid + '\\.jpg$', 'i').test(path);
            })) return null;
        result.pending = { id: pending.id, nick: pending.nick, images: pending.images.slice() };
      }
      return result;
    }
    function load() {
      var text = localStorage.getItem(key), data;
      if (!text) return [];
      if (text.length > 400000) { localStorage.removeItem(key); return []; }
      try { data = JSON.parse(text); } catch (_) { localStorage.removeItem(key); return []; }
      var rows = data && data.version === 1 && Array.isArray(data.drafts)
        ? data.drafts.slice(0, 24).map(clean).filter(Boolean) : [];
      if (!data || !Array.isArray(data.drafts) || rows.length !== data.drafts.length) save(rows);
      return rows;
    }
    function save(rows) {
      if (rows.length) localStorage.setItem(key, JSON.stringify({ version: 1, drafts: rows }));
      else localStorage.removeItem(key);
    }
    return {
      read: function (owner) {
        try { return { ok: true, value: load().find(function (row) { return row.owner === owner; }) || null }; }
        catch (_) { return { ok: false, value: null }; }
      },
      latestContinuation: function (owner) {
        if (typeof owner !== 'string' || !owner.startsWith('member:') || !idPattern.test(owner.slice(7)))
          return { ok: true, value: null };
        try {
          var rows = load().filter(function (row) { return row.owner.startsWith(owner + ':continue:'); });
          rows.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
          return { ok: true, value: rows[0] || null };
        } catch (_) { return { ok: false, value: null }; }
      },
      latestGuest: function (tabId) {
        if (!idPattern.test(tabId || '')) return { ok: true, value: null };
        try {
          var rows = load().filter(function (row) { return row.owner.startsWith('guest:' + tabId + ':'); });
          rows.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
          return { ok: true, value: rows[0] || null };
        } catch (_) { return { ok: false, value: null }; }
      },
      write: function (row) {
        try {
          var value = clean(row);
          if (!value) return false;
          var rows = load().filter(function (item) { return item.owner !== row.owner; });
          rows.push(value);
          rows.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
          save(rows.slice(0, 20));
          return true;
        } catch (_) { return false; }
      },
      remove: function (owner) {
        try { save(load().filter(function (row) { return row.owner !== owner; })); return true; }
        catch (_) { return false; }
      },
    };
  }
  window.OrbitBoardWriting = { collect: collect, title: title, render: render, createDraftStore: createDraftStore };
})();

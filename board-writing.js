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
  window.OrbitBoardWriting = { collect: collect, title: title, render: render };
})();

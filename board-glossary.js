(function () {
  'use strict';
  // Reviewed short explanations, not generated interpretations of user posts.
  // Source notes and matching rules: docs/community-writing.md.
  var nasa = 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/';
  var telescope = 'https://www.celestron.com/products/starsense-explorer-12-smartphone-app-enabled-dobsonian-telescope';
  var terms = [
    { names: ['M13', 'M 13'], title: 'M13 · 헤라클레스자리 구상성단', text: '수많은 별이 둥글게 모여 있는 별무리예요. 천체 목록에서 붙인 이름이 M13이에요.', source: nasa + 'messier-13/', publisher: 'NASA' },
    { names: ['M42', 'M 42'], title: 'M42 · 오리온성운', text: '오리온자리에 있는 가스와 먼지 구름이에요. 이 안에서 새로운 별들이 태어나고 있어요.', source: nasa + 'messier-42/', publisher: 'NASA' },
    { names: ['M57', 'M 57'], title: 'M57 · 고리성운', text: '태양과 비슷한 별이 생애의 후반에 내보낸 가스로 이루어진 천체예요. 사진에서 고리처럼 보여 고리성운이라고 불러요.', source: nasa + 'messier-57/', publisher: 'NASA' },
    { names: ['구상성단'], title: '구상성단 · 둥글게 모인 별무리', text: '많은 별이 중력으로 묶여 둥근 모양을 이루는 별무리예요. M13이 한 예예요.', source: nasa + 'messier-13/', publisher: 'NASA' },
    { names: ['성운'], title: '성운 · 우주의 가스와 먼지 구름', text: '우주에 퍼져 있는 가스와 먼지 구름을 말해요. 오리온성운처럼 새 별이 태어나는 곳도 있어요.', source: nasa + 'messier-42/', publisher: 'NASA' },
    { names: ['돕소니안', '돕'], title: '돕 · 돕소니안 망원경', text: '돕은 보통 돕소니안 망원경을 줄여 부르는 말이에요. 받침대 위의 반사망원경을 위아래·좌우로 움직여 대상을 찾는 구조예요.', source: telescope, publisher: 'Celestron · 구조 설명' },
    { names: ['경통'], title: '경통 · 망원경 본체', text: '빛을 모으는 렌즈나 거울이 들어 있는 망원경의 통 부분이에요. 망원경을 받치는 가대와 구분해 부르는 이름이에요.', source: telescope, publisher: 'Celestron' },
    { names: ['가대'], title: '가대 · 망원경을 받치고 움직이는 장치', text: '망원경 본체를 지탱하고 바라보는 방향을 바꾸는 장치예요. 위아래·좌우로 움직이는 경위대 등이 있어요.', source: telescope, publisher: 'Celestron' },
    { names: ['경위대'], title: '경위대 · 위아래·좌우로 움직이는 가대', text: '망원경을 위아래와 좌우 방향으로 움직이는 받침 방식이에요. 돕소니안 받침대도 이 방식이에요.', source: telescope, publisher: 'Celestron' },
    { names: ['아이피스', '접안렌즈'], title: '아이피스 · 눈을 대고 보는 렌즈', text: '망원경에서 눈을 대고 들여다보는 쪽의 렌즈예요. 접안렌즈라고도 불러요.', source: telescope, publisher: 'Celestron' },
    { names: ['구경'], title: '구경 · 빛을 모으는 부분의 지름', text: '망원경에서 빛을 모으는 주된 렌즈나 거울의 지름이에요. 다른 조건이 같다면 구경이 클수록 더 많은 빛을 모을 수 있어요.', source: telescope, publisher: 'Celestron' },
  ];
  var aliases = terms.flatMap(function (term, index) {
    return term.names.map(function (name) { return { name: name, index: index }; });
  }).sort(function (a, b) { return b.name.length - a.name.length; });
  var pattern = new RegExp(aliases.map(function (a) { return a.name; }).join('|'), 'gi');
  var particles = /^(?:은|는|이|가|을|를|에|에서|에게|와|과|도|만|의|으로|로|처럼|보다|부터|까지|이라|라는|라고|입니다|이에요|예요)(?:[^A-Za-z0-9가-힣]|$)/;
  function allowed(text, start, token, end) {
    var before = text[start - 1] || '', after = text.slice(end);
    if (/[A-Za-z0-9가-힣_]/.test(before)) return false;
    if (/^[A-Za-z0-9_]/.test(after)) return false;
    if (/^[가-힣]/.test(after) && !particles.test(after)) return false;
    // Everyday Korean '구경' is ambiguous. Annotate only an optical size phrase.
    if (token === '구경' && !/^[은이가]?\s*[:：]?\s*\d+(?:\.\d+)?\s*(?:mm|cm|인치|["″])/i.test(after)) return false;
    return true;
  }
  function open(index, trigger) {
    var term = terms[index], dialog = document.createElement('dialog');
    dialog.className = 'board-dialog glossary-dialog';
    dialog.setAttribute('aria-labelledby', 'glossaryTitle');
    var heading = document.createElement('h2'); heading.id = 'glossaryTitle'; heading.textContent = term.title;
    var text = document.createElement('p'); text.textContent = term.text;
    var source = document.createElement('a'); source.href = term.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = term.publisher + ' 원문 ↗';
    var actions = document.createElement('div'); actions.className = 'dialog-actions';
    var close = document.createElement('button'); close.type = 'button'; close.className = 'button'; close.textContent = '설명 닫기';
    actions.appendChild(close); dialog.append(heading, text, source, actions); document.body.appendChild(dialog);
    close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) {
      var rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', function () { dialog.remove(); if (trigger.isConnected) trigger.focus({ preventScroll: true }); });
    if (window.OrbitBoardEmbed) OrbitBoardEmbed.prepareDialog(dialog);
    dialog.showModal();
  }
  function annotate(containers) {
    var seen = new Set(), count = 0;
    containers.forEach(function (container) {
      var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT), nodes = [], node;
      while ((node = walker.nextNode())) {
        if (!node.parentElement.closest('a,button,summary,script,style,code,pre')) nodes.push(node);
      }
      nodes.forEach(function (node) {
        var text = node.textContent, result = document.createDocumentFragment(), previous = 0, match;
        var urls = Array.from(text.matchAll(/(?:https?:\/\/|www\.)\S+|\S+@\S+/g));
        pattern.lastIndex = 0;
        while ((match = pattern.exec(text))) {
          var alias = aliases.find(function (a) { return a.name.toLowerCase() === match[0].toLowerCase(); });
          if (seen.has(alias.index) || !allowed(text, match.index, match[0], pattern.lastIndex) || urls.some(function (url) { return match.index >= url.index && match.index < url.index + url[0].length; })) continue;
          result.appendChild(document.createTextNode(text.slice(previous, match.index)));
          var button = document.createElement('button'); button.type = 'button'; button.className = 'glossary-term';
          button.textContent = match[0]; button.setAttribute('aria-label', match[0] + ' 뜻 보기'); button.setAttribute('aria-haspopup', 'dialog');
          button.dataset.term = alias.index;
          button.addEventListener('click', function () { open(Number(this.dataset.term), this); });
          result.appendChild(button); previous = pattern.lastIndex; seen.add(alias.index); count++;
        }
        if (previous) { result.appendChild(document.createTextNode(text.slice(previous))); node.replaceWith(result); }
      });
    });
    return count;
  }
  window.OrbitBoardGlossary = { annotate: annotate };
})();

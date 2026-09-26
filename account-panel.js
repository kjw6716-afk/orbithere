(function () {
  'use strict';
  var dialog, controller, loading, anchor, returnFocus;
  function position() {
    if (!dialog || !dialog.open) return;
    var box = anchor && anchor.isConnected && anchor.getBoundingClientRect();
    var height = dialog.getBoundingClientRect().height;
    dialog.style.top = box && innerWidth >= 640
      ? Math.max(16, Math.min(box.bottom + 10, innerHeight - height - 16)) + 'px' : '50%';
    dialog.style.right = box && innerWidth >= 640 ? Math.max(16, innerWidth - box.right) + 'px' : 'auto';
    dialog.style.left = box && innerWidth >= 640 ? 'auto' : '50%';
    dialog.style.transform = box && innerWidth >= 640 ? 'none' : 'translate(-50%, -50%)';
  }
  function close() {
    if (controller && controller.isBusy()) return;
    if (dialog && dialog.open) dialog.close();
  }
  async function prepare(initial) {
    var response = await fetch('account.html?v=20260926-separated');
    if (!response.ok) throw new Error('account_unavailable');
    var parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    var template = parsed.getElementById('accountTemplate');
    if (!template) throw new Error('account_unavailable');
    dialog = document.createElement('dialog');
    dialog.className = 'account-dialog';
    dialog.setAttribute('aria-labelledby', 'accountPanelTitle');
    dialog.innerHTML = '<header class="account-panel-heading"><h2 id="accountPanelTitle">로그인</h2><button type="button" class="account-close" aria-label="계정 창 닫기"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></header>';
    dialog.append(document.importNode(template.content, true));
    document.body.append(dialog);
    controller = window.mountOrbitAccount(dialog, initial);
    dialog.querySelector('.account-close').onclick = close;
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); close(); });
    dialog.addEventListener('click', function (event) {
      var rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
    });
    dialog.addEventListener('close', function () {
      controller.clearSecrets();
      if (anchor) anchor.setAttribute('aria-expanded', 'false');
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({preventScroll:true});
    });
    if (window.ResizeObserver) new ResizeObserver(position).observe(dialog);
    window.addEventListener('resize', position);
  }
  async function open(options) {
    options = options || {};
    if (document.documentElement.classList.contains('embed') && parent !== window) {
      parent.postMessage({orbit:'openAccount', mode: options.mode === 'signup' ? 'signup' : 'login'}, location.origin);
      return;
    }
    var loungeFrame = document.getElementById('loungeFrame');
    if (loungeFrame && loungeFrame.closest('.panel.on') && loungeFrame.contentWindow)
      loungeFrame.contentWindow.postMessage({orbit:'accountOpening'}, location.origin);
    anchor = options.anchor || document.getElementById('profileChip');
    returnFocus = document.activeElement;
    // Keep only a same-origin, public page route. Authentication tokens never enter this record.
    var route = new URL(location.href); route.searchParams.delete('account');
    if (['/main.html','/lounge.html','/index.html'].includes(route.pathname)) {
      try { sessionStorage.setItem('orbit_account_return', JSON.stringify({path:route.pathname + route.search + route.hash, at:Date.now()})); } catch (_) { /* Email login can continue without a saved return route. */ }
    }
    try {
      if (!loading) loading = prepare(options).catch(function (error) { loading = null; throw error; });
      await loading;
      var staleError = document.getElementById('accountLoadError');
      if (staleError) staleError.remove();
      controller.mode(options.mode || 'login');
      if (!dialog.open) dialog.showModal();
      if (anchor) anchor.setAttribute('aria-expanded', 'true');
      position();
      await window.OrbitMembers.refresh();
    } catch (_) {
      // A failed lazy load stays on the current page and can be retried.
      var message = document.getElementById('accountLoadError');
      if (!message) { message = document.createElement('p'); message.id = 'accountLoadError'; message.className = 'account-load-error'; message.setAttribute('role','status'); document.body.append(message); }
      message.textContent = '로그인 창을 불러오지 못했어요. 잠시 후 다시 눌러주세요.';
    }
  }
  window.OrbitAccount = {open:open, close:close};
  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-account-open]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault(); open({mode:link.dataset.accountOpen,anchor:link});
  });
  window.addEventListener('message', function (event) {
    var frame = document.getElementById('loungeFrame');
    if (event.origin !== location.origin || !frame || event.source !== frame.contentWindow || !event.data || event.data.orbit !== 'openAccount') return;
    open({mode:event.data.mode});
  });
  var params = new URLSearchParams(location.search), initial = params.get('account');
  if (['login','signup','recovery','google-withdraw','oauth-error'].includes(initial)) {
    params.delete('account');
    history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '') + location.hash);
    open({mode:initial === 'signup' ? 'signup' : 'login',flow:initial});
  }
})();

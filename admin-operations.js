(function () {
  'use strict';
  window.createOrbitOperations = function (sb) {
    var panel = document.getElementById('operationsPanel'), generation = 0, authorized = false, timer;
    var mail = panel.querySelector('[data-mail-status]'), news = panel.querySelector('[data-news-status]'), list = panel.querySelector('[data-mail-list]');
    var labels = {'email.bounced':'반송','email.suppressed':'발송 차단','email.failed':'발송 실패','email.complained':'스팸 신고','email.delivery_delayed':'전달 지연'};
    function date(value) { return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}); }
    async function load() {
      if (!authorized) return;
      var token = ++generation;
      await Promise.allSettled([loadMail(token),loadNews(token)]);
    }
    async function loadMail(token) {
      try {
        var result = await sb.rpc('admin_delivery_alerts');
        if (result.error) throw result.error;
        if (token !== generation || !authorized) return;
        var data = result.data;
        if (!data || !Array.isArray(data.events)) throw new Error('invalid response');
        mail.textContent = '인증메일 · 미확인 ' + data.unread + '건';
        mail.dataset.warning = data.unread > 0 ? 'true' : 'false';
        list.replaceChildren();
        data.events.forEach(function (event) {
          var item = document.createElement('li'), title = document.createElement('p'), detail = document.createElement('p');
          title.textContent = (labels[event.event_type] || '메일 오류') + ' · ' + event.recipient;
          detail.textContent = date(event.occurred_at) + (event.reason ? ' · ' + event.reason : '') + (event.acknowledged_at ? ' · 확인됨' : '');
          item.append(title,detail);
          if (/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(event.email_id)) {
            var link = document.createElement('a'); link.href = 'https://resend.com/emails/' + event.email_id;
            link.target = '_blank'; link.rel = 'noopener'; link.textContent = '발송 기록 열기'; item.append(link);
          }
          if (!event.acknowledged_at) {
            var button = document.createElement('button'); button.type = 'button'; button.className = 'btn-line'; button.textContent = '확인했어요';
            button.addEventListener('click', async function () {
              if (!authorized || button.disabled) return;
              var operationGeneration = generation;
              button.disabled = true;
              try {
                var result = await sb.rpc('acknowledge_delivery_event',{p_event_id:event.event_id,p_recipient:event.recipient});
                if (result.error) throw result.error;
                if (authorized && generation === operationGeneration) await load();
              } catch (_) {
                if (authorized && generation === operationGeneration) mail.textContent = '확인 처리를 저장하지 못했어요. 다시 시도해주세요.';
              } finally { button.disabled = false; }
            });
            item.append(button);
          }
          list.append(item);
        });
        if (!data.events.length) list.textContent = '최근 30일간 수신한 실패 알림이 없어요.';
      } catch (_) {
        if (token !== generation || !authorized) return;
        list.replaceChildren(); mail.textContent = '인증메일 알림을 불러오지 못했어요. 연결을 확인해주세요.'; mail.dataset.warning = 'true';
      }
    }
    async function loadNews(token) {
      try {
        var response = await fetch('data/news.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error('news unavailable');
        var health = window.orbitNewsHealth(await response.json());
        if (token !== generation || !authorized) return;
        news.dataset.warning = health.stale || health.failedSources ? 'true' : 'false';
        news.textContent = !health.valid ? '뉴스 · 수집 기록을 확인할 수 없어요.' :
          '뉴스 · ' + (health.stale ? '갱신 지연' : health.allFailed ? '전체 수집원 확인 필요' : health.failedSources ? '일부 수집원 확인 필요' : '정상') +
          ' · 마지막 수집 ' + date(health.checkedAt) + ' · 수집원 ' + (health.totalSources - health.failedSources) + '/' + health.totalSources + ' 정상';
      } catch (_) {
        if (token !== generation || !authorized) return;
        news.textContent = '뉴스 · 수집 기록을 불러오지 못했어요.'; news.dataset.warning = 'true';
      }
    }
    panel.querySelector('[data-operations-refresh]').addEventListener('click',load);
    return {setAuthorized:function (on) {
      authorized = !!on; ++generation; clearInterval(timer); panel.hidden = !authorized;
      mail.textContent = ''; news.textContent = ''; list.replaceChildren();
      if (authorized) { load(); timer = setInterval(function () { if (!document.hidden) load(); },60000); }
    }};
  };
})();

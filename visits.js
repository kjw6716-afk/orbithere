// ============================================================
// 방문 집계 + 위젯
// ------------------------------------------------------------
// Supabase RPC(record_visit) 한 번으로 오늘/누적 방문 수를 받아온다.
// supabase-js 없이 REST를 직접 부르므로 이 파일 하나로 어느 페이지에서도 돈다.
// 서버 쪽 준비물: supabase/migration_009_visits.sql
//
// - 같은 기기는 하루 한 번만 +1 (localStorage 날짜 도장 — 새로고침으로 안 부푼다)
// - 임베드(iframe) 화면은 부모 페이지가 이미 세므로 아무것도 하지 않는다
// - <script src="visits.js" data-count-only> 로 넣으면 세기만 하고 위젯은 안 그린다
//   (index.html — 대문은 아무 곳이나 누르면 입장이라 위젯이 클릭을 가로챈다)
// - 마이그레이션 전이거나 요청이 실패하면 위젯을 그리지 않는다.
//   깨진 위젯보다 없는 위젯이 낫다.
// ============================================================
(function(){
    if(document.documentElement.classList.contains('embed')) return;

    var SB_URL = 'https://unwxpuvfqyjhgrcrmuhu.supabase.co';
    var SB_KEY = 'sb_publishable_KnyriHKUHNWw0QyIAXBmOA_0KaHPcXI'; // 공개용 키 (publishable)
    var countOnly = document.currentScript && document.currentScript.hasAttribute('data-count-only');

    // sv-SE 로케일은 YYYY-MM-DD 형식이라 날짜 도장으로 쓰기 좋다 (기기 시간대 기준)
    var KEY = 'orbit_visit_day';
    var today = new Date().toLocaleDateString('sv-SE');
    var counted = localStorage.getItem(KEY) === today;

    fetch(SB_URL + '/rest/v1/rpc/record_visit', {
        method: 'POST',
        headers: {
            'apikey': SB_KEY,
            'Authorization': 'Bearer ' + SB_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_count: !counted })
    }).then(function(r){
        if(!r.ok) throw new Error('record_visit ' + r.status);
        return r.json();
    }).then(function(data){
        var row = Array.isArray(data) ? data[0] : data;
        if(!row) return;
        if(!counted) localStorage.setItem(KEY, today);
        if(!countOnly) render(Number(row.today) || 0, Number(row.total) || 0);
    }).catch(function(){ /* 위젯은 장식이다 — 실패해도 페이지는 멀쩡해야 한다 */ });

    function render(todayN, totalN){
        var el = document.createElement('aside');
        el.className = 'visit-widget';
        el.setAttribute('aria-label', '방문 집계');
        el.innerHTML =
            '<span class="vw-dot" aria-hidden="true"></span>' +
            '<div class="vw-body">' +
            '<div class="vw-cap">오늘 이 궤도를 지난 사람</div>' +
            '<div class="vw-num">' + todayN.toLocaleString('ko-KR') +
            '<span class="vw-total">누적 ' + totalN.toLocaleString('ko-KR') + '</span></div>' +
            '</div>';
        // main.html처럼 사이드바가 있으면 그 아래칸에 넣고("좌측 한켠"),
        // 없으면 화면 왼쪽 아래에 떠 있는 작은 카드로 둔다.
        var side = document.querySelector('.sidebar');
        if(side){ el.classList.add('in-sidebar'); side.appendChild(el); }
        else { el.classList.add('floating'); document.body.appendChild(el); }
    }
})();

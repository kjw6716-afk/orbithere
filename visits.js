// ============================================================
// 방문 집계
// ------------------------------------------------------------
// Supabase RPC(record_visit)를 하루 한 번 부른다. 그게 전부다.
// supabase-js 없이 REST를 직접 부르므로 이 파일 하나로 어느 페이지에서도 돈다.
// 서버 쪽 준비물: supabase/migration_009_visits.sql → migration_010_visit_guard.sql
//
// 【숫자를 화면에 띄우지 않는 이유】
// 처음에는 방문자 수 위젯을 페이지에 그렸다. 지금 오빗은 시작 단계라 그 숫자가
// 한 자리나 두 자리인데, 그러면 들어온 사람이 제일 먼저 보는 정보가
// "여기 아무도 없다"는 증거가 된다. 빈 채널이 커 보이는 게 싫어서 .minor로
// 한 톤 낮춰 놓고, 옆에 방문자 0을 띄우면 같은 문제를 더 직접적으로 만드는 셈이다.
// 그래서 세기는 그대로 세고, 보는 건 관제실(admin.html)에서만 한다.
// 숫자가 자랑스러워지면 그때 꺼내면 된다 — 그때는 반대로 사회적 증거가 된다.
//
// - 하루 한 번 제한의 진짜 주인은 서버다(migration_010). 여기 localStorage 도장은
//   이미 센 날 요청을 아예 안 보내려는 것뿐이라, 지워져도 숫자는 안 부푼다.
// - 임베드(iframe) 화면은 부모 페이지가 이미 세므로 아무것도 하지 않는다
// - 실패해도 조용히 넘어간다 — 집계 때문에 페이지가 흔들릴 이유가 없다
// ============================================================
(function(){
    if(document.documentElement.classList.contains('embed')) return;

    var SB_URL = 'https://unwxpuvfqyjhgrcrmuhu.supabase.co';
    var SB_KEY = 'sb_publishable_KnyriHKUHNWw0QyIAXBmOA_0KaHPcXI'; // 공개용 키 (publishable)

    // sv-SE 로케일은 YYYY-MM-DD 형식이라 날짜 도장으로 쓰기 좋다 (기기 시간대 기준)
    var KEY = 'orbit_visit_day';
    var today = new Date().toLocaleDateString('sv-SE');
    if(localStorage.getItem(KEY) === today) return;

    // 광장(lounge.html)이 쓰는 것과 같은 기기 ID. 먼저 오는 쪽이 만들고 뒤는 물려받는다.
    var device = localStorage.getItem('orbit_device_id');
    if(!device){
        device = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now() + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem('orbit_device_id', device);
    }

    fetch(SB_URL + '/rest/v1/rpc/record_visit', {
        method: 'POST',
        headers: {
            'apikey': SB_KEY,
            'Authorization': 'Bearer ' + SB_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_device: device })
    }).then(function(r){
        // 실패한 날은 도장을 찍지 않는다 — 다음 방문 때 다시 시도한다
        if(r.ok) localStorage.setItem(KEY, today);
    }).catch(function(){ /* 집계는 장식이다 — 실패해도 페이지는 멀쩡해야 한다 */ });
})();

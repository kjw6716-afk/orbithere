// The calendar and tonight preview share one unchanged schedule and time boundary model.
(function (root) {
    'use strict';
    var MS_DAY = 86400000;

    // ---------- 이벤트 데이터 ----------
    // watchStart/watchEnd: 목록에 안내할 관측 기간 [시작, 종료), 모두 KST.
    // 유성우/보름달의 끝은 아래 안내 밤의 새벽 마감(05시 또는 06시)이며
    // 실제 활동 종료나 도시별 일출 예측이 아니다. 여러 밤 사이의 낮도 안내 기간에 포함한다.
    // peakAt: 시각이 알려진 극대/최대식만 기록. 날짜만 알려졌으면 null + peakText.
    // 일식·월식 기간은 전지구 P1~P4(반영 포함). EclipseWise의 UT1 예측을
    // 초 단위로 반올림해 KST로 옮겼다. Eclipse Predictions by Fred Espenak, www.EclipseWise.com.
    // 극대는 종료 판정에 사용하지 않는다.
    // kr    : 국내 관측 가능 여부.
    var EVENTS = [
        {
            id:'perseids2026', type:'meteor', ic:'☄️', kr:true,
            name:'페르세우스자리 유성우',
            watchStart:'2026-08-12T23:00:00+09:00',
            watchEnd:'2026-08-14T05:00:00+09:00',
            peakAt:'2026-08-13T12:00:00+09:00',
            dateText:'2026년 8월 12일 밤 ~ 14일 새벽',
            peakText:'8월 13일 12시경 (KST)',
            zhr:100,
            radiant:'페르세우스자리 — 북동쪽 하늘',
            best:'12일 밤~13일 새벽, 13일 밤~14일 새벽 모두 좋습니다. 자정 이후가 특히 유리합니다.',
            desc:'3대 유성우 중 하나이며, 여름 휴가철과 겹쳐 가장 보기 좋은 유성우로 꼽힙니다. 스위프트-터틀 혜성이 남긴 부스러기가 지구 대기와 부딪히며 타는 현상입니다. 2026년은 극대 직전인 8월 12일이 신월이라 밤새 달빛 방해가 사실상 없습니다 — 몇 년 만에 오는 최상의 조건입니다.',
            hi:true
        },
        {
            id:'tse2026', type:'eclipse', ic:'🌑', kr:false,
            name:'개기일식 (국내 관측 불가)',
            watchStart:'2026-08-13T00:34:11+09:00',
            watchEnd:'2026-08-13T04:57:57+09:00',
            peakAt:'2026-08-13T02:45:53+09:00',
            sourceUrl:'https://eclipsewise.com/solar/SEprime/2001-2100/SE2026Aug12Tprime.html',
            dateText:'2026년 8월 13일 새벽 (KST)',
            peakText:'8월 13일 02:46경 (KST)',
            radiant:null,
            best:null,
            desc:'21세기 들어 유럽 대륙에서 볼 수 있는 첫 개기일식입니다. 개기식대는 북극 상공에서 그린란드 동부와 아이슬란드를 지나 스페인 북부까지 이어집니다. 최대 지속 시간은 약 2분 18초입니다. 한국은 이 시각이 한밤중이라 해가 지평선 아래에 있어 부분일식조차 볼 수 없습니다.'
        },
        {
            id:'ple2026', type:'eclipse', ic:'🌗', kr:false,
            name:'부분월식 (국내 관측 불가)',
            watchStart:'2026-08-28T10:23:29+09:00',
            watchEnd:'2026-08-28T16:02:00+09:00',
            peakAt:'2026-08-28T13:12:52+09:00',
            sourceUrl:'https://eclipsewise.com/lunar/LEprime/2001-2100/LE2026Aug28Pprime.html',
            dateText:'2026년 8월 28일 낮 (KST)',
            peakText:'8월 28일 13:13경 (KST)',
            desc:'달의 약 96%가 지구 본그림자에 들어가는, 개기월식에 가까운 매우 깊은 부분월식입니다. 아메리카 대륙에서 가장 잘 보이고 유럽·아프리카에서는 달이 지기 직전 낮게 보입니다. 한국은 이 시각이 대낮이라 달이 지평선 아래에 있어 관측할 수 없습니다.'
        },
        {
            id:'orionids2026', type:'meteor', ic:'☄️', kr:true,
            name:'오리온자리 유성우',
            watchStart:'2026-10-21T02:00:00+09:00',
            watchEnd:'2026-10-21T06:00:00+09:00',
            peakAt:null,
            dateText:'2026년 10월 21일 전후 새벽',
            peakText:'10월 21일 전후 (해마다 조정)',
            zhr:20,
            radiant:'오리온자리 — 동쪽~남동쪽 하늘',
            best:'복사점이 충분히 높이 올라오는 자정 이후~새벽이 좋습니다.',
            desc:'핼리 혜성이 남긴 부스러기로 만들어지는 유성우입니다. 개수는 많지 않지만 유성의 속도가 매우 빨라 밝고 긴 자취를 남기는 것이 특징입니다.'
        },
        {
            id:'leonids2026', type:'meteor', ic:'☄️', kr:true,
            name:'사자자리 유성우',
            watchStart:'2026-11-17T03:00:00+09:00',
            watchEnd:'2026-11-17T06:00:00+09:00',
            peakAt:null,
            dateText:'2026년 11월 17일 전후 새벽',
            peakText:'11월 17일 전후 (해마다 조정)',
            zhr:15,
            radiant:'사자자리 — 동쪽 하늘',
            best:'사자자리가 떠오르는 자정 이후~새벽.',
            desc:'평년에는 조용하지만 약 33년 주기로 시간당 수천 개가 쏟아지는 "유성 폭풍"을 일으킨 전력이 있는 유성우입니다. 유성의 진입 속도가 가장 빠른 편에 속합니다.'
        },
        {
            id:'geminids2026', type:'meteor', ic:'🌠', kr:true,
            name:'쌍둥이자리 유성우',
            watchStart:'2026-12-14T23:00:00+09:00',
            watchEnd:'2026-12-15T06:00:00+09:00',
            peakAt:'2026-12-14T23:00:00+09:00',
            dateText:'2026년 12월 14일 밤 ~ 15일 새벽',
            peakText:'12월 14일 23시 (KST)',
            zhr:150,
            radiant:'쌍둥이자리 — 북동쪽 하늘',
            best:'극대 시각이 한국의 밤과 정확히 겹칩니다. 14일 밤부터 15일 새벽까지가 최적입니다.',
            desc:'1년 중 가장 많은 유성이 떨어지는 유성우입니다. 혜성이 아니라 소행성 파에톤이 남긴 부스러기라는 점이 독특합니다. 유성의 속도가 느린 편이라 초보자도 알아보기 쉽고, 2026년은 극대 시각이 한국 밤 시간과 겹치는 데다 달빛 방해도 적어 조건이 매우 좋습니다.',
            hi:true
        },
        {
            id:'ursids2026', type:'meteor', ic:'☄️', kr:true,
            name:'작은곰자리 유성우',
            watchStart:'2026-12-22T02:00:00+09:00',
            watchEnd:'2026-12-22T06:00:00+09:00',
            peakAt:null,
            dateText:'2026년 12월 22일 전후 새벽',
            peakText:'12월 22일 전후 (해마다 조정)',
            zhr:10,
            radiant:'작은곰자리 — 북쪽 하늘 (북극성 부근)',
            best:'복사점이 북쪽 하늘에 늘 떠 있어 밤새 관측할 수 있습니다.',
            desc:'개수는 적지만 복사점이 북극성 근처라 밤새 지지 않는다는 장점이 있습니다. 한겨울 추위 대비가 관측의 절반입니다.'
        },
        {
            id:'supermoon2026', type:'moon', ic:'🌕', kr:true,
            name:'2026년 가장 큰 보름달 (슈퍼문)',
            watchStart:'2026-12-24T19:00:00+09:00',
            watchEnd:'2026-12-25T06:00:00+09:00',
            peakAt:null,
            dateText:'2026년 12월 24일 밤 ~ 25일 새벽',
            peakText:'해가 진 직후부터 밤새',
            desc:'달이 지구에 가장 가까운 지점 근처에서 보름이 되어, 2026년 한 해 중 가장 크고 밝게 보이는 보름달입니다. 크리스마스이브 밤에 뜬다는 점에서 더 특별합니다. 지평선 근처에 낮게 떠 있을 때 건물이나 산과 함께 보면 훨씬 크게 느껴집니다.',
            hi:true
        },
        {
            id:'quadrantids2027', type:'meteor', ic:'☄️', kr:true,
            name:'사분의자리 유성우',
            watchStart:'2027-01-04T03:00:00+09:00',
            watchEnd:'2027-01-04T06:00:00+09:00',
            peakAt:null,
            dateText:'2027년 1월 4일 새벽',
            peakText:'1월 3~4일 (해마다 조정 · 잠정)',
            zhr:120,
            radiant:'목동자리 부근 — 북동쪽 하늘',
            best:'극대가 몇 시간으로 매우 짧아 날짜를 정확히 맞춰야 합니다.',
            desc:'3대 유성우 중 하나지만 극대가 몇 시간밖에 지속되지 않아 타이밍을 놓치기 쉽습니다. 한겨울 새벽이라 관측 난이도도 높은 편이지만, 조건이 맞으면 3대 유성우답게 화려합니다.'
        },
        {
            id:'ase2027', type:'eclipse', ic:'🌑', kr:false,
            name:'금환일식 (국내 관측 불가)',
            watchStart:'2027-02-06T21:57:34+09:00',
            watchEnd:'2027-02-07T04:01:38+09:00',
            peakAt:'2027-02-07T00:59:35+09:00',
            sourceUrl:'https://eclipsewise.com/solar/SEprime/2001-2100/SE2027Feb06Aprime.html',
            dateText:'2027년 2월 6일 밤 ~ 7일 새벽 (KST)',
            peakText:'2월 7일 00:59:35 (KST)',
            desc:'달이 태양보다 작게 보여 태양 가장자리가 반지처럼 남는 금환일식입니다. 남아메리카 남부와 대서양 일대에서 관측됩니다. 한국에서는 볼 수 없습니다.'
        },
        {
            id:'lyrids2027', type:'meteor', ic:'☄️', kr:true,
            name:'거문고자리 유성우',
            watchStart:'2027-04-22T03:00:00+09:00',
            watchEnd:'2027-04-22T05:00:00+09:00',
            peakAt:null,
            dateText:'2027년 4월 22일 전후 새벽',
            peakText:'4월 22일 전후 (잠정)',
            zhr:18,
            radiant:'거문고자리 — 동쪽 하늘 (직녀성 부근)',
            best:'자정 이후 복사점이 높이 뜬 뒤가 좋습니다.',
            desc:'기록에 남은 가장 오래된 유성우 중 하나로, 2,600년 전 중국 기록에도 등장합니다. 개수는 많지 않지만 가끔 아주 밝은 유성이 섞여 나옵니다.'
        },
        {
            id:'etaaqr2027', type:'meteor', ic:'☄️', kr:true,
            name:'물병자리 에타 유성우',
            watchStart:'2027-05-06T03:30:00+09:00',
            watchEnd:'2027-05-06T05:00:00+09:00',
            peakAt:null,
            dateText:'2027년 5월 6일 전후 새벽',
            peakText:'5월 6일 전후 (잠정)',
            zhr:50,
            radiant:'물병자리 — 동쪽 하늘 (낮게 뜸)',
            best:'복사점이 낮아 동틀 무렵 새벽에만 잠깐 볼 수 있습니다.',
            desc:'오리온자리 유성우와 마찬가지로 핼리 혜성이 남긴 부스러기입니다. 남반구에서 훨씬 잘 보이고, 한국에서는 복사점이 낮게 떠서 새벽 짧은 시간에만 관측할 수 있습니다.'
        },
        {
            id:'tse2027', type:'eclipse', ic:'🌑', kr:false,
            name:'개기일식 (국내 관측 불가)',
            watchStart:'2027-08-02T16:30:09+09:00',
            watchEnd:'2027-08-02T21:43:09+09:00',
            peakAt:'2027-08-02T19:06:37+09:00',
            sourceUrl:'https://eclipsewise.com/solar/SEprime/2001-2100/SE2027Aug02Tprime.html',
            dateText:'2027년 8월 2일',
            peakText:'8월 2일 19:06:37 (KST)',
            desc:'최대 지속 시간이 약 6분 23초에 달하는, 21세기 육지에서 관측 가능한 가장 긴 개기일식입니다. 스페인 남부와 북아프리카를 지나 이집트 룩소르 상공을 통과합니다. 맑은 날이 많은 지역을 지나기 때문에 "세기의 일식"으로 불리며 벌써부터 원정 관측 계획이 세워지고 있습니다. 한국에서는 볼 수 없습니다.'
        }
    ];

    function parseKST(s) { return new Date(s); }

    function calendarDays(target, now) {
        var offset = 9 * 3600000;
        return Math.floor((target + offset) / MS_DAY) - Math.floor((now + offset) / MS_DAY);
    }

    function ddayLabel(target, now) {
        var days = calendarDays(target, now);
        return days <= 0 ? 'D-DAY' : 'D-' + days;
    }

    function eventTiming(e, now) {
        var start = parseKST(e.watchStart).getTime();
        var end = parseKST(e.watchEnd).getTime();
        var status = now < start ? 'scheduled' : now < end ? 'ongoing' : 'ended';
        var target = status === 'scheduled' ? start : end;
        return {
            start: start, end: end, status: status, target: target,
            remaining: Math.max(0, target - now),
            label: status === 'ongoing' ? '진행 중' : status === 'ended' ? '종료' : ddayLabel(start, now)
        };
    }

    function activeEvents(events, now, filter) {
        return events.map(function (e) {
            return { e: e, t: parseKST(e.watchStart).getTime(), timing: eventTiming(e, now) };
        }).filter(function (x) {
            if (x.timing.status === 'ended') return false;
            if (!filter || filter === 'all') return true;
            return filter === 'kr' ? x.e.kr === true : x.e.type === filter;
        }).sort(function (a, b) { return a.t - b.t; });
    }

    function eventStatusText(e, timing) {
        return timing.status === 'ongoing' && e.type !== 'eclipse' ? '안내 기간 중' : timing.label;
    }

    function eventDateTime(ms) {
        var d = new Date(ms + 9 * 3600000);
        function two(n) { return String(n).padStart(2, '0'); }
        return d.getUTCFullYear() + '.' + two(d.getUTCMonth() + 1) + '.' + two(d.getUTCDate()) + ' ' +
            two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) +
            (d.getUTCSeconds() ? ':' + two(d.getUTCSeconds()) : '');
    }

    function eventRangeText(e) {
        return (e.type === 'eclipse' ? '전지구 진행 기간 ' : '안내 기간 ') +
            eventDateTime(parseKST(e.watchStart).getTime()) + ' ~ ' +
            eventDateTime(parseKST(e.watchEnd).getTime()) + ' KST';
    }


    function previewState(events, now) {
        var next = activeEvents(events, now, 'all')[0];
        if (next) {
            return {
                id: next.e.id,
                status: next.timing.status,
                label: eventStatusText(next.e, next.timing),
                name: next.e.name.replace(/\s*\(국내 관측 불가\)$/, ''),
                meta: next.e.dateText + ' · ' + (next.e.kr ? '국내 관측 가능' : '국내 관측 불가')
            };
        }
        var ended = events.filter(function (e) { return eventTiming(e, now).status === 'ended'; })
            .sort(function (a, b) { return Date.parse(b.watchEnd) - Date.parse(a.watchEnd); })[0];
        return {
            id: '', status: ended ? 'exhausted' : 'empty', label: '일정 안내',
            name: '다음 천문 일정을 준비하고 있어요',
            meta: ended ? '최근 일정: ' + ended.name + ' · 종료' : '새 일정이 등록되면 여기에서 알려드릴게요.'
        };
    }

    function nextPreviewRefresh(events, now) {
        var offset = 9 * 3600000;
        var next = (Math.floor((now + offset) / MS_DAY) + 1) * MS_DAY - offset;
        events.forEach(function (e) {
            [e.watchStart, e.watchEnd].forEach(function (value) {
                var boundary = Date.parse(value);
                if (boundary > now && boundary < next) next = boundary;
            });
        });
        return next;
    }

    // Re-evaluate the same real schedule at start/end and KST midnight, including a background-tab return.
    function mountPreview(container, events) {
        var timer = null;
        function render() {
            clearTimeout(timer);
            var now = Date.now();
            var state = previewState(events, now);
            container.dataset.eventState = state.status;
            container.dataset.eventId = state.id;
            container.querySelector('[data-event-label]').textContent = state.label;
            container.querySelector('[data-event-name]').textContent = state.name;
            container.querySelector('[data-event-meta]').textContent = state.meta;
            timer = setTimeout(render, Math.max(1, nextPreviewRefresh(events, now) - Date.now()));
        }
        function resume() { if (!container.ownerDocument.hidden) render(); }
        container.ownerDocument.addEventListener('visibilitychange', resume);
        render();
        return { render: render, destroy: function () {
            clearTimeout(timer);
            container.ownerDocument.removeEventListener('visibilitychange', resume);
        } };
    }

    root.OrbitSkyEvents = {
        EVENTS: EVENTS, parseKST: parseKST, calendarDays: calendarDays, ddayLabel: ddayLabel,
        eventTiming: eventTiming, activeEvents: activeEvents, eventStatusText: eventStatusText,
        eventDateTime: eventDateTime, eventRangeText: eventRangeText,
        previewState: previewState, nextPreviewRefresh: nextPreviewRefresh, mountPreview: mountPreview
    };
})(window);

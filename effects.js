/* Orbit 클릭 이펙트 — requestAnimationFrame 기반 파티클 엔진
   기존 CSS 키프레임 방식 대신 매 프레임 위치를 계산해
   중력/감속/회전/반짝임이 있는 물리감을 표현한다.

   모바일 주의점: 캔버스는 레이아웃 뷰포트가 아니라 "실제로 보이는 영역"
   (visualViewport)에 맞춘다. 핀치 확대나 키보드가 올라와 보이는 영역이
   바뀌어도 파티클이 배율만큼 커지거나 지워지지 않은 잔상이 남지 않는다. */
(function () {
    // 기기에서 "동작 줄이기"를 켠 사용자에게는 파티클을 띄우지 않는다.
    // CSS는 orbit.css의 prefers-reduced-motion 블록이 맡지만, 캔버스로 그리는
    // 이 이펙트는 CSS가 닿지 않으므로 여기서 직접 확인해야 한다.
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion && reduceMotion.matches) return;

    var ACCENT = '#FF9F43';   // 별 메인
    var LIGHT  = '#FFD08A';   // 별 라이트
    var MINT   = '#4FD1C5';   // 반짝이 포인트 (대문의 민트와 연결)

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9999;transform-origin:0 0;';
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var vv = window.visualViewport || null;

    // 보이는 영역: 크기(w,h), 레이아웃 뷰포트 기준 오프셋(x,y), 확대 배율(s)
    var view = { w: 0, h: 0, x: 0, y: 0, s: 1 };

    function measure() {
        if (vv) {
            view.w = vv.width; view.h = vv.height;
            view.x = vv.offsetLeft; view.y = vv.offsetTop;
            view.s = vv.scale || 1;
        } else {
            view.w = window.innerWidth; view.h = window.innerHeight;
            view.x = 0; view.y = 0; view.s = 1;
        }
    }

    function place() {
        // 위치만 갱신 — 캔버스 크기를 건드리지 않아 진행 중인 파티클이 지워지지 않는다
        canvas.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px)';
    }

    function resize() {
        measure();
        canvas.style.width = view.w + 'px';
        canvas.style.height = view.h + 'px';
        canvas.width = Math.round(view.w * dpr);   // 대입 자체가 캔버스를 비운다
        canvas.height = Math.round(view.h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        place();
    }

    function onViewportScroll() { measure(); place(); }

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    if (vv) {
        vv.addEventListener('resize', resize);
        vv.addEventListener('scroll', onViewportScroll);
    }
    document.body.appendChild(canvas);
    resize();

    var parts = [];
    var running = false;
    var last = 0;

    function starPath(c, r) {
        c.beginPath();
        for (var i = 0; i < 5; i++) {
            var a = -Math.PI / 2 + i * 2 * Math.PI / 5;
            var b = a + Math.PI / 5;
            c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            c.lineTo(Math.cos(b) * r * 0.5, Math.sin(b) * r * 0.5);
        }
        c.closePath();
    }

    function burst(x, y) {
        // 젤리 별 — 위로 살짝 던져진 뒤 중력으로 떨어지며 회전
        var n = 7 + Math.floor(Math.random() * 5);
        for (var i = 0; i < n; i++) {
            var ang = Math.random() * Math.PI * 2;
            var spd = 2.2 + Math.random() * 3.4;
            var roll = Math.random();
            parts.push({
                type: 'star', x: x, y: y,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1.6,
                g: 0.11, drag: 0.985,
                rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3,
                r: 3.5 + Math.random() * 4,
                life: 1, decay: 0.012 + Math.random() * 0.012,
                color: roll < 0.18 ? MINT : roll < 0.6 ? ACCENT : LIGHT
            });
        }
        // 잔 반짝이 — 가볍게 떠다니며 깜빡임
        for (var j = 0; j < 6; j++) {
            var a2 = Math.random() * Math.PI * 2;
            var s2 = 1 + Math.random() * 2.4;
            parts.push({
                type: 'dot', x: x, y: y,
                vx: Math.cos(a2) * s2, vy: Math.sin(a2) * s2 - 0.8,
                g: 0.05, drag: 0.99,
                r: 0.8 + Math.random() * 1.4,
                life: 1, decay: 0.02 + Math.random() * 0.02,
                tw: Math.random() * Math.PI * 2,
                color: Math.random() < 0.3 ? MINT : LIGHT
            });
        }
        // 확산 링
        parts.push({ type: 'ring', x: x, y: y, r: 6, vrad: 3.2, life: 1, decay: 0.028, color: ACCENT });

        if (!running) {
            running = true;
            last = performance.now();
            requestAnimationFrame(tick);
        }
    }

    function tick(now) {
        var dt = Math.min((now - last) / 16.67, 2); // 프레임 드랍 시에도 속도 일정
        last = now;
        // 백킹 스토어 전체를 지운다 — 보이는 영역이 바뀌어도 잔상이 남지 않는다
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var i = parts.length - 1; i >= 0; i--) {
            var p = parts[i];
            p.life -= p.decay * dt;
            if (p.life <= 0) { parts.splice(i, 1); continue; }

            if (p.type === 'ring') {
                p.r += p.vrad * dt;
                p.vrad *= Math.pow(0.96, dt);
                ctx.globalAlpha = p.life * 0.8;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.stroke();
                continue;
            }

            p.vy += p.g * dt;
            p.vx *= Math.pow(p.drag, dt);
            p.vy *= Math.pow(p.drag, dt);
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // 보이는 영역 밖으로 나간 입자는 즉시 정리
            if (p.x < -60 || p.x > view.w + 60 || p.y > view.h + 60) { parts.splice(i, 1); continue; }

            if (p.type === 'star') {
                p.rot += p.vr * dt;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.globalAlpha = Math.min(1, p.life * 1.6);
                ctx.fillStyle = p.color;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.r * 0.9; // 두꺼운 라운드 스트로크로 젤리 느낌
                ctx.lineJoin = 'round';
                starPath(ctx, p.r * (0.5 + p.life * 0.5));
                ctx.stroke();
                ctx.fill();
                ctx.restore();
            } else {
                var twinkle = 0.6 + 0.4 * Math.sin(now / 80 + p.tw);
                ctx.globalAlpha = Math.max(0, p.life) * twinkle;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        if (parts.length) requestAnimationFrame(tick);
        else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }

    function isTextField(el) {
        if (!el) return false;
        var tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
    }

    document.addEventListener('click', function (e) {
        measure();

        // 확대된 상태에서는 파티클을 띄우지 않는다 (좌표·배율이 어긋나 화면을 뒤덮는다)
        if (view.s > 1.05) return;

        // 입력창 탭은 키보드를 여닫으며 레이아웃을 흔든다 — 이펙트 대상에서 제외
        if (isTextField(e.target) || (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]'))) return;
        if (isTextField(document.activeElement)) return;

        var x = e.clientX - view.x;   // 레이아웃 뷰포트 좌표 → 보이는 영역 좌표
        var y = e.clientY - view.y;
        if (x < 0 || y < 0 || x > view.w || y > view.h) return;

        burst(x, y);
    });
})();

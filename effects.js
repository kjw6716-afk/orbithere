/* Orbit 클릭 이펙트 — requestAnimationFrame 기반 파티클 엔진
   기존 CSS 키프레임 방식 대신 매 프레임 위치를 계산해
   중력/감속/회전/반짝임이 있는 물리감을 표현한다. */
(function () {
    var ACCENT = '#FF9F43';   // 별 메인
    var LIGHT  = '#FFD08A';   // 별 라이트
    var MINT   = '#4FD1C5';   // 반짝이 포인트 (대문의 민트와 연결)

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);
    // iOS에서 키보드가 열리거나 핀치줌 될 때는 window resize가 안 올 수 있음
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    document.body.appendChild(canvas);
    resize();

    // 리사이즈/줌으로 캔버스 크기와 innerWidth가 어긋나도 항상 전체를 지우도록
    function clearAll() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

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
        clearAll();

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
        else { running = false; clearAll(); }
    }

    document.addEventListener('click', function (e) {
        // 입력하려고 누른 탭에는 이펙트를 터뜨리지 않는다
        var t = e.target;
        if (t && t.closest && t.closest('input, textarea, select, label')) return;
        burst(e.clientX, e.clientY);
    });
})();

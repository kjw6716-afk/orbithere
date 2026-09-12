(() => {
    const range = document.getElementById('altitudeRange');
    const direction = document.getElementById('directionSelect');
    const map = document.getElementById('sampleSkyMap');
    if (!range || !direction || !map) return;
    // Teaching fixtures, never ephemerides or a forecast for the user's location.
    const examples = {
        jupiter: { name: '목성 예시', azimuth: 135, altitude: 30 },
        saturn: { name: '토성 예시', azimuth: 180, altitude: 45 },
        venus: { name: '금성 예시', azimuth: 270, altitude: 15 }
    };
    const directions = ['북쪽', '북동쪽', '동쪽', '남동쪽', '남쪽', '남서쪽', '서쪽', '북서쪽'];
    const between = ['', '북쪽과 동쪽 사이, ', '', '동쪽과 남쪽 사이, ', '', '남쪽과 서쪽 사이, ', '', '서쪽과 북쪽 사이, '];
    const presets = [...document.querySelectorAll('[data-example]')];
    let selectedExample = 'jupiter';
    function attrs(id, values) {
        const element = document.getElementById(id);
        for (const [key, value] of Object.entries(values)) element.setAttribute(key, value);
    }
    function say(id, value) { document.getElementById(id).textContent = value; }
    function update() {
        const angle = Number(range.value);
        const azimuth = Number(direction.value);
        const directionIndex = azimuth / 45;
        const bearing = directions[directionIndex];
        const rad = angle * Math.PI / 180;
        const x = 60 + 180 * Math.cos(rad);
        const y = 210 - 180 * Math.sin(rad);
        const name = selectedExample ? examples[selectedExample].name : '연습 천체';
        attrs('bearingPointer', { transform: `rotate(${azimuth} 180 140)` });
        say('bearingTitle', `위에서 본 나침반: ${bearing} 바라보기`);
        say('bearingDesc', `북쪽이 위, 동쪽이 오른쪽입니다. 민트색 화살표가 방위 ${azimuth}도, ${bearing}을 가리킵니다.`);
        say('directionHint', `${between[directionIndex]}${bearing}을 바라봐요.`);
        attrs('sightLine', { x2: x, y2: y });
        attrs('sightPoint', { cx: x, cy: y });
        attrs('angleArc', { d: `M 108 210 A 48 48 0 0 0 ${60 + 48 * Math.cos(rad)} ${210 - 48 * Math.sin(rad)}` });
        say('angleValue', angle + '°');
        range.setAttribute('aria-valuetext', `지평선에서 ${angle}도`);
        say('angleTitle', `지평선에서 고도 ${angle}도 올려다보기`);
        say('angleDesc', `옆에서 본 시선입니다. 민트색 선이 지평선에서 위로 ${angle}도 기울어 있습니다.`);
        say('angleHint', angle === 0 ? '지평선과 같은 높이예요.' :
            angle === 90 ? '머리 바로 위, 천정이에요. 이 지점에서는 동서남북을 따로 맞추지 않아도 돼요.' :
            angle === 45 ? '지평선과 머리 위의 중간 높이예요.' :
            angle === 30 ? '지평선에서 머리 위까지의 약 3분의 1 높이예요.' :
            `지평선에서 ${angle}°만큼 시선을 올려다봐요.`);
        // Same 0..360° horizontal / 0..90° vertical mapping as planets.html.
        const px = 44 + azimuth / 360 * 662;
        const py = 262 - angle / 90 * 232;
        attrs('samplePlanet', { cx: px, cy: py });
        attrs('samplePlanetHalo', { cx: px, cy: py });
        attrs('sampleProjection', { d: `M 44 ${py} H ${px} V 262` });
        const scale = Math.max(1, 720 / (map.clientWidth || 720));
        const font = 12 * scale;
        map.querySelector('.map-axis').setAttribute('font-size', font);
        attrs('samplePlanetLabel', {
            x: px > 460 ? px - 12 * scale : px + 12 * scale,
            y: py < 30 + font * 2 ? py + font * 1.7 : py - font,
            'text-anchor': px > 460 ? 'end' : 'start', 'font-size': font
        });
        say('samplePlanetLabel', name);
        say('sampleMapTitle', `학습용 ${name}: ${bearing}, 고도 ${angle}도`);
        say('sampleMapDesc', `실제 예보가 아닌 연습 지도입니다. 가로축은 북·동·남·서·북, 세로축은 고도 0도부터 90도입니다. ${name}의 방위는 ${azimuth}도, 고도는 ${angle}도입니다.`);
        say('sampleInstruction', angle === 90 ? '머리 바로 위를 올려다봐요. 천정에서는 방향보다 높이에 집중하면 돼요.' :
            angle === 0 ? `${bearing}으로 몸을 돌리고, 평평한 지평선 방향을 바라봐요.` :
            `${bearing}으로 몸을 돌리고, 지평선에서 ${angle}° 올려다봐요.`);
        say('sampleValues', `${name} · 방위 ${azimuth}° · 고도 ${angle}°`);
        presets.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.example === selectedExample)));
    }
    range.addEventListener('input', () => { selectedExample = null; update(); });
    direction.addEventListener('change', () => { selectedExample = null; update(); });
    document.querySelectorAll('[data-angle]').forEach(button => {
        button.addEventListener('click', () => { range.value = button.dataset.angle; selectedExample = null; update(); });
        button.disabled = false;
    });
    presets.forEach(button => {
        button.addEventListener('click', () => {
            selectedExample = button.dataset.example;
            const example = examples[selectedExample];
            direction.value = example.azimuth;
            range.value = example.altitude;
            update();
        });
        button.disabled = false;
    });
    range.disabled = false;
    direction.disabled = false;
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(map);
    else window.addEventListener('resize', update);
    update();
})();

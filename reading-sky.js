(() => {
    const range = document.getElementById('altitudeRange');
    if (!range) return;
    function update() {
        const angle = Number(range.value);
        const rad = angle * Math.PI / 180;
        const x = 60 + 180 * Math.cos(rad);
        const y = 210 - 180 * Math.sin(rad);
        const line = document.getElementById('sightLine');
        const point = document.getElementById('sightPoint');
        line.setAttribute('x2', x); line.setAttribute('y2', y);
        point.setAttribute('cx', x); point.setAttribute('cy', y);
        document.getElementById('angleValue').textContent = angle + '°';
        document.getElementById('angleTitle').textContent = `지평선에서 고도 ${angle}도 올려다보기`;
        document.getElementById('angleHint').textContent = angle === 0 ? '지평선과 같은 높이예요.' :
            angle === 90 ? '머리 바로 위, 천정이에요.' :
            angle === 45 ? '지평선과 머리 위의 중간 높이예요.' :
            angle === 30 ? '지평선에서 머리 위까지의 약 3분의 1 높이예요.' :
            `지평선에서 ${angle}°만큼 시선을 올려다봐요.`;
    }
    range.addEventListener('input', update);
    update();
})();

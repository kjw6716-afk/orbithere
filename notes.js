(() => {
    'use strict';
    const form = document.getElementById('noteForm');
    const output = document.getElementById('noteOutput');
    const status = document.getElementById('noteStatus');
    const length = document.getElementById('noteLength');
    if (!form || !output) return;
    const field = name => form.elements.namedItem(name);
    const value = name => field(name).value.trim();
    const buttons = ['copyNote', 'downloadNote'].map(id => document.getElementById(id));
    function update() {
        const when = value('when').replace('T', ' ');
        const lines = [
            `[관측 기록] ${value('target') || '대상 미입력'}`,
            `일시: ${when ? when + ' KST' : '미입력'}`,
            `지역: ${value('place') || '미입력'}`,
            `장비: ${value('equipment')}`,
            `결과: ${value('result')}`,
            `조건: ${value('conditions') || '미입력'}`,
            `관찰·다음 시도: ${value('detail') || '미입력'}`
        ];
        // Text only: user input is never interpreted as markup or sent to a server.
        output.value = lines.join('\n');
        length.textContent = `${output.value.length} / 500자 · 게시판 한 글에 담을 수 있는 길이`;
        const tooLong = output.value.length > 500;
        buttons.forEach(button => button.disabled = tooLong);
        if (tooLong) length.textContent = `${output.value.length} / 500자 · 500자 이내로 줄여주세요`;
        status.textContent = '';
    }
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('reset', () => setTimeout(() => {
        update();
        status.textContent = '입력을 지웠어요.';
    }, 0));
    document.getElementById('copyNote').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(output.value);
            status.textContent = '기록을 복사했어요. 메모 앱이나 관측 후기 게시판에 붙여 넣어주세요.';
        } catch {
            output.focus();
            output.select();
            status.textContent = '자동 복사가 지원되지 않아 기록을 선택했어요. 복사 메뉴를 이용해주세요.';
        }
    });
    document.getElementById('downloadNote').addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob(['\uFEFF' + output.value], {type: 'text/plain;charset=utf-8'}));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'orbit-observation.txt';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = '다운로드를 요청했어요. 브라우저의 다운로드 목록을 확인해주세요.';
    });
    update();
})();

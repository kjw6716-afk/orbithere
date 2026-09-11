(() => {
    'use strict';
    const form = document.getElementById('noteForm');
    const output = document.getElementById('noteOutput');
    const status = document.getElementById('noteStatus');
    const length = document.getElementById('noteLength');
    if (!form || !output) return;
    const field = name => form.elements.namedItem(name);
    const value = name => field(name).value.trim();
    const key = 'orbit_observation_draft';
    const names = ['target','when','place','equipment','result','conditions','detail'];
    const savedStatus = document.getElementById('savedNoteStatus');
    let cleanSnapshot = '';
    const snapshot = () => JSON.stringify(Object.fromEntries(names.map(name => [name,field(name).value])));
    function readSaved() {
        try {
            const saved = JSON.parse(localStorage.getItem(key) || 'null');
            if (!saved || saved.version !== 1 || !saved.fields || typeof saved.savedAt !== 'string') return null;
            return saved;
        } catch { return null; }
    }
    function savedSummary() {
        const saved = readSaved();
        document.getElementById('restoreNote').hidden = !saved;
        document.getElementById('deleteSavedNote').hidden = !saved;
        savedStatus.textContent = saved ? '이 브라우저에 저장한 기록이 있어요. ' + (Number.isNaN(Date.parse(saved.savedAt)) ? '' : new Date(saved.savedAt).toLocaleString('ko-KR')) : '이 브라우저에 저장된 기록이 없습니다.';
    }
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
        if (tooLong) length.textContent = `${output.value.length}자 · 파일로 보관할 수 있어요. 게시판에 올릴 때는 500자 이내로 줄여주세요.`;
        status.textContent = '';
    }
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('reset', () => setTimeout(() => {
        update();
        cleanSnapshot = snapshot();
        status.textContent = '입력을 지웠어요.';
    }, 0));
    document.getElementById('copyNote').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(output.value);
            cleanSnapshot = snapshot();
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
    document.getElementById('saveNote').addEventListener('click', () => {
        try {
            localStorage.setItem(key, JSON.stringify({version:1, savedAt:new Date().toISOString(), fields:JSON.parse(snapshot())}));
            cleanSnapshot = snapshot();
            savedSummary();
            status.textContent = '이 기기에 저장했어요. 이전 저장본은 이 기록으로 바뀌었습니다.';
        } catch { status.textContent = '기기 저장 공간을 사용할 수 없어요. 복사하거나 파일로 내려받아 주세요.'; }
    });
    document.getElementById('restoreNote').addEventListener('click', () => {
        const saved = readSaved();
        if (!saved) { savedSummary(); return; }
        if (snapshot() !== cleanSnapshot && !confirm('작성 중인 내용을 저장한 기록으로 바꿀까요?')) return;
        names.forEach(name => {
            const input=field(name), raw=saved.fields[name];
            if (typeof raw !== 'string') return;
            if (input.tagName === 'SELECT' && !Array.from(input.options).some(option => option.value === raw)) return;
            input.value=raw.slice(0, input.maxLength > 0 ? input.maxLength : 100);
        });
        update(); cleanSnapshot=snapshot();
        status.textContent='저장한 기록을 불러왔어요. 수정한 뒤 다시 저장해주세요.';
    });
    document.getElementById('deleteSavedNote').addEventListener('click', () => {
        try { localStorage.removeItem(key); savedSummary(); status.textContent='기기 저장본을 삭제했어요. 화면에 작성 중인 내용은 유지됩니다.'; }
        catch { status.textContent='기기 저장본을 삭제하지 못했어요. 브라우저의 사이트 데이터 설정을 확인해주세요.'; }
    });
    window.addEventListener('beforeunload', event => {
        if (snapshot() !== cleanSnapshot) { event.preventDefault(); event.returnValue=''; }
    });
    update();
    cleanSnapshot=snapshot();
    savedSummary();
})();

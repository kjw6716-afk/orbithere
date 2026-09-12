/* Retirement page: read/export/remove an existing note. Never writes a new note. */
(() => {
    'use strict';
    const key = 'orbit_observation_draft';
    const status = document.getElementById('noteStatus');
    const output = document.getElementById('noteOutput');
    const actions = document.getElementById('savedNoteActions');
    const show = document.getElementById('showSavedNote');
    const labels = {target:'관측 대상', when:'관측 일시 (한국 시간)', place:'대략적인 지역', equipment:'장비', result:'결과', conditions:'조건', detail:'관찰·다음 시도'};
    let savedText = '';
    try {
        const raw = localStorage.getItem(key);
        if (!raw) { status.textContent = '이 브라우저에 저장된 관측 노트가 없습니다.'; return; }
        savedText = raw;
        try {
            const record = JSON.parse(raw);
            if (record?.version === 1 && record.fields && typeof record.fields === 'object') {
                savedText = '[ORBIT 관측 기록]\n' + Object.entries(labels).map(([name, label]) => `${label}: ${typeof record.fields[name] === 'string' ? record.fields[name] : '미입력'}`).join('\n');
            }
        } catch { /* Offer damaged/old records as raw text for recovery. Never interpret HTML. */ }
        show.hidden = false;
        status.textContent = '이전에 저장한 기록이 있어요. 직접 열어 확인하거나 내려받을 수 있습니다.';
    } catch {
        status.textContent = '브라우저 저장소에 접근할 수 없어요. 저장했던 브라우저의 사이트 데이터 설정을 확인해주세요.';
        return;
    }
    show.addEventListener('click', () => {
        output.value = savedText;
        actions.hidden = false; show.hidden = true; output.focus();
        status.textContent = '저장본을 열었어요. 원본은 이 브라우저에 그대로 남아 있습니다.';
    });
    document.getElementById('downloadNote').addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob(['\uFEFF' + savedText], {type:'text/plain;charset=utf-8'}));
        const link = document.createElement('a'); link.href = url; link.download = 'orbit-observation.txt';
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = '다운로드를 요청했어요. 다운로드 목록에서 파일을 확인해주세요.';
    });
    document.getElementById('copyNote').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(savedText); status.textContent = '저장한 기록을 복사했어요.'; }
        catch { output.focus(); output.select(); status.textContent = '기록을 선택했어요. 직접 복사해주세요.'; }
    });
    document.getElementById('deleteSavedNote').addEventListener('click', () => {
        if (!confirm('이 브라우저의 저장본을 삭제할까요? 필요한 기록은 먼저 내려받아 주세요.')) return;
        try {
            localStorage.removeItem(key);
            output.value = ''; savedText = ''; actions.hidden = true;
            status.textContent = '이 브라우저의 관측 노트 저장본을 삭제했어요.';
        } catch { status.textContent = '저장본을 삭제하지 못했어요. 브라우저 설정에서 사이트 데이터를 확인해주세요.'; }
    });
})();

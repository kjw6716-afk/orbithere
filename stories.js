(() => {
    'use strict';
    const search = document.getElementById('storySearch');
    if (search) {
        search.parentElement.hidden = false;
        const rows = [...document.querySelectorAll('[data-story-search]')];
        const count = document.getElementById('storyCount');
        search.addEventListener('input', () => {
            const query = search.value.trim().toLocaleLowerCase('ko-KR');
            let visible = 0;
            rows.forEach(row => {
                row.hidden = !(row.textContent + ' ' + row.dataset.storySearch).toLocaleLowerCase('ko-KR').includes(query);
                if (!row.hidden) visible++;
            });
            count.textContent = `${visible}편`;
            document.getElementById('storyEmpty').hidden = visible !== 0;
        });
    }
    const share = document.getElementById('shareStory');
    if (share) {
        share.hidden = false;
        share.addEventListener('click', async () => {
            const url = document.querySelector('link[rel="canonical"]').href;
            const status = document.getElementById('shareStatus');
            try {
                await navigator.clipboard.writeText(url);
                status.textContent = '이 이야기의 주소를 복사했어요.';
                document.getElementById('shareFallback').hidden = true;
            } catch {
                const input = document.getElementById('shareFallback');
                input.hidden = false; input.value = url; input.focus(); input.select();
                status.textContent = '아래 주소를 선택해 복사해주세요.';
            }
        });
    }
})();

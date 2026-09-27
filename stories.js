(() => {
    'use strict';
    const search = document.getElementById('storySearch');
    if (search) {
        search.parentElement.hidden = false;
        const filters = document.querySelector('.story-filters');
        const buttons = [...filters.querySelectorAll('[data-story-category]')];
        const rows = [...document.querySelectorAll('[data-story-search]')].map(row => ({
            element: row,
            category: row.dataset.storyCategory,
            text: (row.textContent + ' ' + row.dataset.storySearch).toLocaleLowerCase('ko-KR')
        }));
        const count = document.getElementById('storyCount');
        const empty = document.getElementById('storyEmpty');
        const emptyMessage = document.getElementById('storyEmptyMessage');
        const grid = document.querySelector('#storyResults .story-grid');
        let category = '';
        const updateResults = () => {
            const term = search.value.trim();
            const query = term.toLocaleLowerCase('ko-KR');
            let visible = 0;
            rows.forEach(row => {
                row.element.hidden = !((!category || row.category === category) && row.text.includes(query));
                if (!row.element.hidden) visible++;
            });
            buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.storyCategory === category)));
            count.textContent = [category || '전체', ...(term ? [`“${term}”`] : []), `${visible}편`].join(' · ');
            empty.hidden = visible !== 0;
            emptyMessage.textContent = term
                ? `${category || '전체 이야기'}에서 “${term}”에 맞는 이야기를 찾지 못했어요. 검색어를 바꾸거나 다른 주제를 골라보세요.`
                : `${category || '전체 이야기'}에 공개된 이야기가 아직 없어요. 다른 주제를 골라보세요.`;
            grid.hidden = ![...grid.children].some(row => !row.hidden);
        };
        search.addEventListener('input', updateResults);
        buttons.forEach(button => button.addEventListener('click', () => {
            category = button.dataset.storyCategory;
            updateResults();
        }));
        document.getElementById('storyReset').addEventListener('click', () => {
            search.value = '';
            category = '';
            updateResults();
            search.focus();
        });
        filters.hidden = false;
        updateResults();
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

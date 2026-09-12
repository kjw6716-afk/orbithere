(() => {
    'use strict';
    const belt = document.querySelector('.story-belt');
    if (!belt) return;
    const viewport = belt.querySelector('.story-belt-viewport');
    const track = belt.querySelector('.story-belt-track');
    const original = belt.querySelector('[data-story-original]');
    const cards = [...original.children];
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const speed = 20; // Pixels per second, independent of the number of stories.
    let frame = null, last = null, phase = 0, cycle = 0, center = 0, step = 0;
    let hovered = false, touching = false, focused = false, inView = true, pointerFocus = false;

    function paint() { track.style.transform = `translateX(${center - 2 * cycle + phase}px)`; }
    function stop() {
        cancelAnimationFrame(frame);
        frame = last = null;
    }
    function tick(now) {
        if (last !== null) phase = (phase + Math.min(now - last, 50) * speed / 1000) % cycle;
        paint();
        last = now;
        frame = requestAnimationFrame(tick);
    }
    function sync() {
        stop();
        if (belt.classList.contains('flowing') && cycle > 0 && !hovered && !touching && !focused && inView && !document.hidden) {
            phase = ((phase % cycle) + cycle) % cycle;
            frame = requestAnimationFrame(tick);
        }
    }
    function measure() {
        if (!belt.classList.contains('flowing')) return;
        const priorStep = step;
        cycle = original.getBoundingClientRect().width;
        step = cycle / cards.length;
        center = (viewport.clientWidth - cards[0].getBoundingClientRect().width) / 2;
        if (priorStep) phase *= step / priorStep;
        paint();
        sync();
    }
    function configure() {
        stop();
        track.querySelectorAll('[data-story-clone]').forEach(group => group.remove());
        belt.classList.remove('flowing');
        track.style.transform = '';
        phase = step = 0;
        viewport.scrollLeft = 0;
        focused = belt.contains(document.activeElement);
        const focusedIndex = cards.findIndex(card => card.contains(document.activeElement));
        if (motion.matches || cards.length < 2) {
            if (focusedIndex >= 0) viewport.scrollLeft = cards[focusedIndex].offsetLeft - cards[0].offsetLeft;
            return;
        }
        // Two groups before and one after keep both edges covered across the loop.
        // Copies stay clickable, while keyboard/screen readers see each story once.
        for (const before of [true, true, false]) {
            const clone = original.cloneNode(true);
            clone.removeAttribute('data-story-original');
            clone.setAttribute('data-story-clone', '');
            clone.setAttribute('aria-hidden', 'true');
            clone.querySelectorAll('a').forEach(link => { link.tabIndex = -1; });
            if (before) track.prepend(clone); else track.append(clone);
        }
        belt.classList.add('flowing');
        measure();
        if (focusedIndex >= 0) { phase = -focusedIndex * step; paint(); }
    }
    belt.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'touch') { hovered = true; sync(); }
    });
    belt.addEventListener('pointerleave', () => { hovered = false; sync(); });
    belt.addEventListener('pointerdown', event => {
        pointerFocus = true;
        if (event.pointerType === 'touch') { touching = true; sync(); }
    });
    for (const event of ['pointerup', 'pointercancel']) {
        addEventListener(event, () => {
            pointerFocus = false;
            if (touching) { touching = false; sync(); }
        });
    }
    belt.addEventListener('focusin', event => {
        focused = true;
        sync();
        const index = cards.indexOf(event.target.closest('.story-belt-card'));
        if (index >= 0 && !pointerFocus && belt.classList.contains('flowing')) {
            phase = -index * step;
            paint();
            viewport.scrollLeft = 0;
        }
    });
    belt.addEventListener('focusout', () => queueMicrotask(() => {
        focused = belt.contains(document.activeElement);
        sync();
    }));
    document.addEventListener('visibilitychange', sync);
    addEventListener('pagehide', stop);
    addEventListener('pageshow', sync);
    motion.addEventListener('change', configure);
    new ResizeObserver(measure).observe(viewport);
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting;
            sync();
        }, {threshold: 0.15}).observe(belt);
    }
    configure();
})();

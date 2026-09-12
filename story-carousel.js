(() => {
    'use strict';
    const carousel = document.querySelector('.story-carousel');
    if (!carousel) return;
    const slides = [...carousel.querySelectorAll('.story-slide')];
    if (slides.length < 2) return;
    const previous = carousel.querySelector('[data-story-prev]');
    const next = carousel.querySelector('[data-story-next]');
    const play = carousel.querySelector('.story-carousel-play');
    const count = carousel.querySelector('.story-carousel-count');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let active = 0, timer, busy = false, hovered = false, inView = true;
    let transitions = [];
    let paused = motion.matches;

    function schedule() {
        clearTimeout(timer);
        if (!paused && !hovered && inView && !document.hidden && !busy) {
            timer = setTimeout(() => move(1), 4000);
        }
    }
    function update() {
        play.textContent = paused ? '자동 넘김 시작' : '자동 넘김 정지';
        play.setAttribute('aria-label', `이야기 ${play.textContent}`);
        count.setAttribute('aria-live', paused ? 'polite' : 'off');
        count.textContent = `${active + 1} / ${slides.length}`;
        schedule();
    }
    function pause() { paused = true; update(); }
    async function move(direction, manual = false) {
        if (manual) pause();
        if (busy) return;
        busy = true;
        clearTimeout(timer);
        const old = slides[active];
        const hadFocus = old.contains(document.activeElement);
        active = (active + direction + slides.length) % slides.length;
        const current = slides[active];
        old.classList.remove('is-current');
        old.classList.add('is-outgoing');
        old.inert = true;
        old.setAttribute('aria-hidden', 'true');
        old.querySelector('a').tabIndex = -1;
        current.classList.add('is-current');
        current.inert = false;
        current.removeAttribute('aria-hidden');
        current.querySelector('a').removeAttribute('tabindex');
        if (hadFocus) current.querySelector('a').focus({preventScroll: true});
        update();
        if (!motion.matches) {
            const options = {duration: 420, easing: 'cubic-bezier(.22,.61,.36,1)'};
            // The next story enters from the left; the previous card travels right.
            transitions = [
                old.animate([{transform: 'translateX(0)'}, {transform: `translateX(${direction * 110}%)`}], options),
                current.animate([{transform: `translateX(${-direction * 110}%)`}, {transform: 'translateX(0)'}], options)
            ];
            await Promise.allSettled(transitions.map(animation => animation.finished));
            transitions.forEach(animation => animation.cancel());
            transitions = [];
        }
        old.classList.remove('is-outgoing');
        busy = false;
        schedule();
    }
    previous.addEventListener('click', () => move(-1, true));
    next.addEventListener('click', () => move(1, true));
    play.addEventListener('click', () => { paused = !paused; update(); });
    // Reading with the keyboard pauses until the user explicitly restarts.
    carousel.addEventListener('focusin', event => { if (event.target !== play) pause(); });
    carousel.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'touch') { hovered = true; schedule(); }
    });
    carousel.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    carousel.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowRight' ? 1 : -1, true);
        }
    });
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', () => { transitions.forEach(animation => animation.finish()); pause(); });
    addEventListener('pagehide', () => clearTimeout(timer));
    addEventListener('pageshow', schedule);
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting;
            schedule();
        }, {threshold: 0.15}).observe(carousel);
    }
    carousel.classList.add('enhanced');
    previous.hidden = next.hidden = false;
    carousel.querySelector('.story-carousel-controls').hidden = false;
    update();
})();

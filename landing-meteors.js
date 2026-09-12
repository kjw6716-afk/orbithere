(() => {
    'use strict';
    const layer = document.querySelector('.starfield');
    if (!layer) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const between = (min, max) => min + Math.random() * (max - min);
    let timer = null, active = null;
    const allowed = () => !document.hidden && !motion.matches;

    function clear() {
        clearTimeout(timer);
        timer = null;
        const previous = active;
        active = null;
        if (previous) { previous.animation.cancel(); previous.node.remove(); }
    }
    function schedule() {
        clearTimeout(timer);
        if (allowed() && !active) timer = setTimeout(shoot, between(20000, 45000));
    }
    function shoot() {
        timer = null;
        if (!allowed() || active) return;
        const node = document.createElement('i');
        node.className = 'meteor';
        const x = between(0.08, 0.92) * innerWidth;
        node.style.left = `${x}px`;
        node.style.top = `${between(0.04, 0.30) * innerHeight}px`;
        const travel = Math.min(innerWidth * 0.2, innerHeight * 0.32) * between(0.7, 1.1);
        const dx = (x < innerWidth / 2 ? 1 : -1) * travel;
        const dy = travel * between(0.8, 1.2);
        const angle = Math.atan2(-dy, -dx) * 180 / Math.PI;
        const transform = progress => `translate3d(${dx * progress}px, ${dy * progress}px, 0) rotate(${angle}deg)`;
        layer.append(node);
        const animation = node.animate([
            {transform: transform(0), opacity: 0, offset: 0},
            {transform: transform(0.12), opacity: 0.55, offset: 0.12},
            {transform: transform(0.7), opacity: 0.25, offset: 0.7},
            {transform: transform(1), opacity: 0, offset: 1}
        ], {duration: between(1600, 2400), easing: 'linear', fill: 'both'});
        const flight = {node, animation};
        active = flight;
        animation.finished.then(() => {
            if (active !== flight) return;
            active = null;
            animation.cancel();
            node.remove();
            schedule();
        }, () => {}); // Cancellation on hide/reduced motion must not queue another flight.
    }
    function restart() { clear(); schedule(); }
    document.addEventListener('visibilitychange', restart);
    motion.addEventListener('change', restart);
    addEventListener('resize', restart);
    addEventListener('pagehide', clear);
    addEventListener('pageshow', restart);
    schedule();
})();

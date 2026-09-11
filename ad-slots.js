(() => {
    'use strict';
    const config = window.ORBIT_ADS;
    // Restrict placement even if this script is accidentally included elsewhere.
    if (!['guide.html','reading-sky.html'].includes(location.pathname.split('/').pop())) return;
    const template = document.querySelector('template[data-ad-placement]');
    if (!template || !config || config.enabled !== true ||
        !/^ca-pub-\d{16}$/.test(config.client) || !/^\d{10}$/.test(config.slot)) return;
    if (document.querySelector('.editorial-ad')) return;
    const ad = template.content.firstElementChild.cloneNode(true);
    const unit = ad.querySelector('ins');
    unit.dataset.adClient = config.client;
    unit.dataset.adSlot = config.slot;
    // The unit must be in the visible layout before the SDK measures its width.
    template.after(ad);
    const observer = new MutationObserver(() => {
        if (unit.getAttribute('data-ad-status') === 'unfilled') { ad.remove(); observer.disconnect(); }
    });
    observer.observe(unit, {attributes:true, attributeFilter:['data-ad-status']});
    const remove = () => { observer.disconnect(); ad.remove(); };
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + config.client;
    script.addEventListener('load', () => {
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
        catch { remove(); }
    }, {once: true});
    script.addEventListener('error', remove, {once: true});
    document.head.append(script);
})();

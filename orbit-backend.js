// Shared request timeout; the Supabase client still owns session refresh.
(function(){
    var config = window.ORBIT_CONFIG;
    var client = null, anonymousRequests = new Set(), anonymousGeneration = 0;
    // Passive view counting must not finish an older anonymous sign-in over an
    // explicit member login. Credential signup and every other request are untouched.
    window.cancelOrbitAnonymousAuth = function(){
        anonymousGeneration++;
        anonymousRequests.forEach(function(controller){ controller.abort(); });
        anonymousRequests.clear();
    };
    function anonymousSignup(input, init){
        try {
            var address = new URL(typeof input === 'string' ? input : input.url, location.href);
            var body = JSON.parse(init && init.body || 'null');
            return address.origin === new URL(config.url).origin &&
                address.pathname === '/auth/v1/signup' && init.method === 'POST' &&
                body && typeof body === 'object' && !('email' in body) && !('phone' in body);
        } catch (_) { return false; }
    }
    window.createOrbitBackend = function(){
        if (client) return client;
        if (!config || !window.supabase) return null;
        return client = window.supabase.createClient(config.url, config.publishableKey, {
            global: { fetch: async function(input, init){
                var controller = new AbortController();
                var original = init && init.signal;
                var anonymous = anonymousSignup(input, init), generation = anonymousGeneration;
                if (anonymous) anonymousRequests.add(controller);
                var abort = function(){ controller.abort(); };
                if(original) { if(original.aborted) abort(); else original.addEventListener('abort', abort, {once:true}); }
                var timer = setTimeout(abort, config.requestTimeoutMs);
                try {
                    var response = await fetch(input, Object.assign({}, init, {signal: controller.signal}));
                    // fetch resolves on headers. Keep the deadline and caller's
                    // abort signal active until the body is available to the SDK.
                    // Drain a clone so the original response (including empty and
                    // error responses) remains unchanged and unread for its caller.
                    await response.clone().arrayBuffer();
                    if (anonymous) {
                        // Auth must not save a cancelled anonymous session after
                        // an explicit member login starts while the body arrives.
                        if (generation !== anonymousGeneration || controller.signal.aborted)
                            throw new DOMException('Anonymous sign-in cancelled', 'AbortError');
                    }
                    return response;
                }
                finally {
                    if (anonymous) anonymousRequests.delete(controller);
                    clearTimeout(timer);
                    if(original) original.removeEventListener('abort', abort);
                }
            } }
        });
    };
})();

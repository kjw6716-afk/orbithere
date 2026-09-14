// Shared request timeout; the Supabase client still owns session refresh.
(function(){
    var config = window.ORBIT_CONFIG;
    var client = null;
    window.createOrbitBackend = function(){
        if (client) return client;
        if (!config || !window.supabase) return null;
        return client = window.supabase.createClient(config.url, config.publishableKey, {
            global: { fetch: async function(input, init){
                var controller = new AbortController();
                var original = init && init.signal;
                var abort = function(){ controller.abort(); };
                if(original) { if(original.aborted) abort(); else original.addEventListener('abort', abort, {once:true}); }
                var timer = setTimeout(abort, config.requestTimeoutMs);
                try { return await fetch(input, Object.assign({}, init, {signal: controller.signal})); }
                finally { clearTimeout(timer); if(original) original.removeEventListener('abort', abort); }
            } }
        });
    };
})();

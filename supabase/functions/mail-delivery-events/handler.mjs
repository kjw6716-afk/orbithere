const EVENTS = new Set(['email.bounced', 'email.suppressed', 'email.failed', 'email.complained', 'email.delivery_delayed']);
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function deliveryRecords(event, eventId) {
  if (!EVENTS.has(event?.type)) return [];
  const data = event.data;
  const from = typeof data?.from === 'string' ? data.from.trim().toLowerCase() : '';
  if (from !== 'accounts@auth.orbithere.com' && !/^[^<>]*<accounts@auth\.orbithere\.com>$/.test(from)) return [];
  if (!UUID.test(data.email_id) || !Array.isArray(data.to) || data.to.length !== 1 ||
      !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(data.to[0]) || data.to[0].length > 320 ||
      !Number.isFinite(Date.parse(event.created_at)) || !eventId || eventId.length > 200) {
    throw new Error('invalid delivery event');
  }
  // Store categorical values only; provider messages may contain PII or content.
  const reason = [data.bounce?.type, data.bounce?.subType, data.suppressed?.type]
    .filter(x => typeof x === 'string' && /^[a-zA-Z0-9_ -]{1,70}$/.test(x)).join(' / ').slice(0,160);
  return [{p_event_id:eventId,p_email_id:data.email_id,p_recipient:data.to[0].toLowerCase(),
    p_event_type:event.type,p_reason:reason,p_occurred_at:new Date(event.created_at).toISOString()}];
}

// verify_jwt=false is intentional: Resend authenticates using Svix HMAC with a
// timestamp and event ID, checked against the *raw* body before parsing/writing.
export function createDeliveryHandler(Webhook, createClient, env) {
  return async req => {
    const reply = (status, body) => new Response(JSON.stringify(body), {status,
      headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    if (req.method !== 'POST') return reply(405,{error:'method_not_allowed'});
    const secret = env('RESEND_WEBHOOK_SECRET'), url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!secret || !url || !key) return reply(503,{error:'not_configured'});
    if (Number(req.headers.get('content-length')) > 65536) return reply(413,{error:'too_large'});
    // A streaming limit also covers requests without Content-Length.
    const reader = req.body?.getReader();
    if (!reader) return reply(400,{error:'body_required'});
    const chunks = []; let length = 0;
    try {
      while (true) {
        const {done,value} = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > 65536) { await reader.cancel(); return reply(413,{error:'too_large'}); }
        chunks.push(value);
      }
    } catch { return reply(400,{error:'invalid_body'}); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
    let event;
    const payload = new TextDecoder().decode(bytes);
    try {
      new Webhook(secret).verify(payload, {
        'svix-id':req.headers.get('svix-id') || '',
        'svix-timestamp':req.headers.get('svix-timestamp') || '',
        'svix-signature':req.headers.get('svix-signature') || '',
      });
    } catch { return reply(401,{error:'invalid_signature'}); }
    let records;
    try {
      // Svix 2.x verifies bytes only; parse JSON explicitly after authentication.
      event = JSON.parse(payload);
      records = deliveryRecords(event, req.headers.get('svix-id'));
    }
    catch { return reply(400,{error:'invalid_event'}); }
    if (!records.length) return reply(200,{ignored:true});
    try {
      const sb = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
      for (const record of records) {
        const result = await sb.rpc('record_delivery_event',record);
        if (result.error) throw new Error('storage failed');
      }
    } catch { return reply(503,{error:'storage_unavailable'}); } // Non-2xx makes Resend retry.
    return reply(200,{recorded:true});
  };
}

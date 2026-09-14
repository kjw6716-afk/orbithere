import assert from 'node:assert/strict';
import { Webhook } from 'svix';
import { createDeliveryHandler } from '../supabase/functions/mail-delivery-events/handler.mjs';
import { recoverNews } from '../scripts/news-watchdog.mjs';
let count = 0;
function check(name,value) { assert.ok(value,name); console.log('✓ '+name); count++; }
const secret = 'whsec_' + Buffer.from('test-only-delivery-secret-32-bytes').toString('base64');
const env = name => ({RESEND_WEBHOOK_SECRET:secret,SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key'}[name] || '');
const writes = []; let fail = false;
const handler = createDeliveryHandler(Webhook, () => ({rpc:async (name,args) => {writes.push({name,args}); return {error:fail ? new Error('db offline') : null};}}), env);
const event = {type:'email.bounced',created_at:new Date().toISOString(),data:{email_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',from:'오빗 Orbit <accounts@auth.orbithere.com>',to:['Person@example.test'],subject:'secret OTP',bounce:{type:'Permanent',subType:'General',message:'SMTP response and PII'}}};
function request(payload = event, {timestamp = new Date(), signature, method = 'POST', id = 'evt-test'} = {}) {
  const body = JSON.stringify(payload);
  return new Request('https://example.test/webhook',{method,headers:{'svix-id':id,'svix-timestamp':String(Math.floor(timestamp.getTime()/1000)),
    'svix-signature':signature || new Webhook(secret).sign(id,timestamp,body)},...(method==='POST'?{body}:{})});
}
check('valid provider signature stores one alert',(await handler(request())).status===200&&writes.length===1);
check('stored alert contains only metadata, no OTP or raw SMTP',writes[0].args.p_recipient==='person@example.test'&&!JSON.stringify(writes).includes('secret OTP')&&!JSON.stringify(writes).includes('SMTP response'));
check('forged signature is rejected before any DB access',(await handler(request(event,{signature:'v1,bad'}))).status===401&&writes.length===1);
check('expired signed request is rejected',(await handler(request(event,{timestamp:new Date(Date.now()-600000)}))).status===401&&writes.length===1);
check('future signed request is rejected',(await handler(request(event,{timestamp:new Date(Date.now()+600000)}))).status===401&&writes.length===1);
check('GET cannot write an event',(await handler(request(event,{method:'GET'}))).status===405);
const altered = request(); const body = (await altered.text()).replace('email.bounced','email.failed');
check('body tampering invalidates a real signature',(await handler(new Request(altered.url,{method:'POST',headers:altered.headers,body}))).status===401);
check('unrelated senders are ignored',(await handler(request({...event,data:{...event.data,from:'accounts@auth.orbithere.com.evil.test'}}))).status===200&&writes.length===1);
check('unneeded delivered event is ignored',(await handler(request({...event,type:'email.delivered'}))).status===200&&writes.length===1);
check('malformed signed event returns an error',(await handler(request({...event,data:{...event.data,to:[]}}))).status===400);
check('oversized request is rejected',(await handler(new Request('https://example.test',{method:'POST',body:'x'.repeat(65537)}))).status===413);
fail = true;
check('database failure returns retryable HTTP status',(await handler(request())).status===503);
check('missing configuration fails closed',(await createDeliveryHandler(Webhook,()=>{throw new Error('must not connect');},()=> '')(request())).status===503);
for (const type of ['email.suppressed','email.failed','email.complained','email.delivery_delayed']) {
  fail = false;
  check(type+' is recorded',(await handler(request({...event,type}))).status===200&&writes.at(-1).args.p_event_type===type);
}
const now = Date.now(), fresh = {checkedAt:new Date(now-3600000).toISOString(),sources:[{status:'ok',lastSuccessfulAt:new Date(now-3600000).toISOString()}]};
check('recent successful collection is healthy',!globalThis.orbitNewsHealth(fresh,now).stale&&!globalThis.orbitNewsHealth(fresh,now).allFailed);
check('five hour old public cache is stale',globalThis.orbitNewsHealth({...fresh,checkedAt:new Date(now-5*3600000).toISOString()},now).stale);
check('fresh timestamp cannot hide failed sources',globalThis.orbitNewsHealth({...fresh,sources:[{status:'unavailable',lastSuccessfulAt:new Date(now-9*3600000).toISOString()}]},now).allFailed);
check('malformed or future cache timestamp is unhealthy',globalThis.orbitNewsHealth({},now).stale&&globalThis.orbitNewsHealth({...fresh,checkedAt:new Date(now+3600000).toISOString()},now).stale);
check('malformed source rows are treated as failures',globalThis.orbitNewsHealth({...fresh,sources:[null]},now).allFailed);
let feed = fresh, runs = [], dispatches = 0;
const requestMock = async (url,options) => {
  if (url==='https://orbithere.com/data/news.json') { assert.equal(options.headers,undefined,'GitHub token never sent to public site'); return Response.json(feed); }
  if (url.endsWith('/dispatches')) { dispatches++; assert.equal(options.method,'POST'); assert.deepEqual(JSON.parse(options.body),{ref:'main'}); return new Response(null,{status:204}); }
  return Response.json({workflow_runs:runs});
};
const run = () => recoverNews({repository:'owner/repo',token:'test-only-token',now,request:requestMock});
check('watchdog skips healthy news',(await run()).action==='healthy'&&dispatches===0);
feed = {...fresh,checkedAt:new Date(now-5*3600000).toISOString()};
check('stale cache dispatches the existing collector',(await run()).action==='dispatched'&&dispatches===1);
runs = [{status:'queued',created_at:new Date(now-3600000).toISOString()}];
check('queued collector prevents duplicate recovery',(await run()).action==='already_running'&&dispatches===1);
runs = [{status:'completed',created_at:new Date(now-600000).toISOString()}];
check('recent attempt imposes cooldown',(await run()).action==='cooldown'&&dispatches===1);
runs=[]; feed={...fresh,sources:[{status:'unavailable'}]};
check('all-source failure triggers recovery even with recent checkedAt',(await run()).action==='dispatched'&&dispatches===2);
await assert.rejects(()=>recoverNews({repository:'owner/repo',token:'test',now,request:async url=> url.includes('api.github') ? new Response('',{status:403}) : Response.json({})}),/403/);
check('GitHub permission failure is surfaced',true);
console.log(`Operations: ${count} checks passed`);

// Real PostgreSQL semantics in WASM. No network, live Auth, or production writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = readFileSync(new URL('../supabase/migrations/20260927041435_minimal_funnel_analytics.sql', import.meta.url), 'utf8');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const ADMIN='33333333-3333-4333-8333-333333333333', ANON='44444444-4444-4444-8444-444444444444';
let checks=0;
const check=(label,value)=>{assert.ok(value,label);checks++;console.log('✓ '+label);};
await db.exec(`
create role anon; create role authenticated; create role service_role; create role unrelated;
create schema auth;
create table auth.users(id uuid primary key,is_anonymous boolean not null default true,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated;
create table public.admins(user_id uuid primary key references auth.users(id));
create table public.posts(id uuid default gen_random_uuid() primary key,author_id uuid references auth.users(id),created_at timestamptz not null default now());
create table public.comments(like public.posts including all);
create table public.reactions(like public.posts including all);
create table public.visits(day date primary key,count bigint not null);
create schema orbit_members_private;
create table orbit_members_private.profiles(user_id uuid primary key references auth.users(id),deleting_at timestamptz);
create table orbit_members_private.rewards(user_id uuid not null references auth.users(id),reward_key text not null,kind text not null,primary key(user_id,reward_key));
insert into auth.users values('${A}',false,now()-interval '6 days'),('${B}',false,now()-interval '3 days'),('${ADMIN}',false,now()-interval '1 day'),('${ANON}',true,null);
insert into admins values('${ADMIN}');
insert into orbit_members_private.profiles(user_id) values('${A}'),('${B}'),('${ADMIN}');
-- Exercise the actual schedule branch without pretending WASM runs pg_cron.
create schema cron;
create table cron.jobs(id bigint generated always as identity primary key,name text unique,schedule text,command text);
create function cron.schedule(p_name text,p_schedule text,p_command text) returns bigint language plpgsql as $$
declare result bigint; begin
 insert into cron.jobs(name,schedule,command) values(p_name,p_schedule,p_command)
 on conflict(name) do update set schedule=excluded.schedule,command=excluded.command returning id into result;
 return result; end $$;
`);
await db.exec(migration);
const installed=(await db.query('select installed_at from orbit_funnel_private.settings')).rows[0].installed_at;
await db.exec(migration);
check('migration reruns preserve installation boundary',(await db.query('select installed_at from orbit_funnel_private.settings')).rows[0].installed_at.getTime()===installed.getTime());
check('migration schedules exactly one dedicated daily purge',(await db.query(`select * from cron.jobs where name='orbit-funnel-retention' and schedule='45 18 * * *' and command='select orbit_funnel_private.maintain()'`)).rows.length===1);
async function as(role,id,sql,values=[]) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id||'']);
  await db.exec('set role '+role);
  return db.query(sql,values);
}
async function denied(label,role,id,sql,values=[]) {
  await assert.rejects(()=>as(role,id,sql,values));checks++;console.log('✓ '+label);
}
const sid=n=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const event=(n,sequence=1,name='session_start',feature='planets',detail='google',extra={})=>({
  session_id:sid(n),sequence,event:name,feature,detail,context:'direct',page_key:feature==='calendar'?'calendar':feature,audience:'guest',...extra,
});
const record=(payload,role='anon',id=null,fn='public.record_funnel_event')=>as(role,id,`select ${fn}($1::jsonb)`,[JSON.stringify(payload)]);
const report=async (from='(now() at time zone \'Asia/Seoul\')::date',to=from)=>
  (await as('authenticated',ADMIN,`select public.funnel_report(${from},${to}) as data`)).rows[0].data;
const today="(now() at time zone 'Asia/Seoul')::date";
const size=async ()=>{await db.exec('reset role');return (await db.query('select count(*) as n from orbit_funnel_private.events')).rows[0].n;};

for(const role of ['anon','authenticated','service_role']) {
  for(const table of ['events','daily','settings']) {
    for(const action of ['select * from','delete from']) await denied(role+' cannot '+action+' '+table,role,role==='authenticated'?ADMIN:null,`${action} orbit_funnel_private.${table}`);
  }
}
await denied('anonymous direct INSERT cannot bypass validation','anon',null,`insert into orbit_funnel_private.events(session_id,sequence,event,feature,detail,context,page_key,audience) values('${sid(1)}',1,'session_start','planets','google','direct','planets','guest')`);
await denied('authenticated direct UPDATE cannot alter events','authenticated',A,"update orbit_funnel_private.events set detail='private input'");
await db.exec('reset role');
check('all three private tables have RLS and no policies',(await db.query(`select count(*) as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='orbit_funnel_private' and c.relkind='r' and c.relrowsecurity and not exists(select 1 from pg_policy p where p.polrelid=c.oid)`)).rows[0].n===3);
check('public APIs are invoker wrappers with fixed search paths',(await db.query(`select bool_and(not p.prosecdef and p.proconfig @> array['search_path=""']) as ok from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('record_funnel_event','funnel_report','funnel_member_report','maintain_funnel_analytics')`)).rows[0].ok);
check('every funnel helper has a fixed empty search path',(await db.query(`select bool_and(p.proconfig @> array['search_path=""']) as ok from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='orbit_funnel_private'`)).rows[0].ok);
for(const fn of ['compute_day(current_date)','maintain()','require_operator()']) {
  await denied('members cannot bypass private helper '+fn,'authenticated',A,'select orbit_funnel_private.'+fn);
  await denied('admin browser cannot bypass private helper '+fn,'authenticated',ADMIN,'select orbit_funnel_private.'+fn);
}
for(const fn of ['public.funnel_report','orbit_funnel_private.report','public.funnel_member_report','orbit_funnel_private.member_report']) {
  await denied('anon cannot call '+fn,'anon',null,`select ${fn}(current_date,current_date)`);
  await denied('non-admin cannot call '+fn,'authenticated',A,`select ${fn}(current_date,current_date)`);
  await denied('missing authenticated subject cannot call '+fn,'authenticated',null,`select ${fn}(current_date,current_date)`);
}
await denied('unrelated role inherits no PUBLIC collector grant','unrelated',null,'select public.record_funnel_event($1::jsonb)',[JSON.stringify(event(1))]);
await denied('anon cannot invoke maintenance wrapper','anon',null,'select maintain_funnel_analytics()');
await denied('members cannot invoke maintenance wrapper','authenticated',A,'select maintain_funnel_analytics()');

const malformed=[
  null,[],{},'free text',event(1,1,'post_publish'),event(1,1,'auth_complete'),
  {...event(1),email:'sensitive@example.test'}, {...event(1),metadata:{text:'sensitive text'}},
  {...event(1),detail:'https://google.com/search?q=private'}, {...event(1),page_key:'https://orbithere.com/lounge.html?private'},
  {...event(1),detail:'x'.repeat(600)}, {...event(1),sequence:'1'}, {...event(1),sequence:1.5},
  {...event(1),sequence:0}, {...event(1),sequence:129}, {...event(1),context:null}, {...event(1),audience:'administrator'},
  {...event(1),session_id:'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa'}, {...event(1),session_id:123},
  {...event(1),event:null}, {...event(1),page_key:'news'},
  event(1,2,'tool_use','planets','filter'),event(1,2,'tool_use','calendar','region'),
  event(1,2,'tool_use','calendar','detail'),event(1,2,'tool_ready','guide','none'),
  event(1,2,'write_start','guide','input'), event(1,2,'board_enter','board','board'),
  event(1,2,'feature_view','news','none',{context:'embed'}),event(1,1,'feature_view','planets','none'),
  event(1,1,'session_start','planets','google',{page_key:'main_planets'}),
  event(1,1,'session_start','calendar','google',{context:'embed'}),
  event(1,1,'session_start','planets','google',{context:'embed',page_key:'main_board'}),
];
for(let i=0;i<malformed.length;i++) await denied('strict payload rejects malformed case '+i,'anon',null,'select record_funnel_event($1::jsonb)',[JSON.stringify(malformed[i])]);
const missing=event(1);delete missing.page_key;
await denied('required keys cannot be omitted','anon',null,'select record_funnel_event($1::jsonb)',[JSON.stringify(missing)]);
await denied('private collector validates the same malicious payload','anon',null,'select orbit_funnel_private.record_event($1::jsonb)',[JSON.stringify({...event(1),metadata:'text'})]);
check('rejected input never adds raw events',await size()===0);
await record(event(77,1,'session_start','planets','google',{context:'embed',page_key:'main_planets'}));
check('valid shell panel uses matching embed page key',await size()===1);
await db.exec(`reset role; delete from orbit_funnel_private.events where session_id='${sid(77)}'`);
await record(event(99),'authenticated',ADMIN);
check('server discards events authenticated as registered admin',await size()===0);
await denied('Auth UUID cannot be reused as telemetry session ID','authenticated',A,'select record_funnel_event($1::jsonb)',[JSON.stringify({...event(1),session_id:A})]);

// The HTTP order is deliberately shuffled; the product journey follows sequence.
await record(event(1,3,'tool_ready','planets','none'));
let data=await report();
check('orphan events are reported but never become sessions',data.days[0].metrics.sessions===0&&data.days[0].metrics.events_without_session_start===1);
await record(event(1));
await record(event(1,2,'feature_view','planets','none'));
await record(event(1,4,'tool_use','planets','time'));
await record(event(1,6,'feature_view','board','none'));
await record(event(1,5,'board_enter','board','planets'));
await record(event(1,7,'write_start','board','explicit'));
await record(event(1,8,'auth_open','board','login'));
await record(event(1,9,'auth_attempt','board','email_login'));
await record(event(1,10,'write_start','board','input'));
await record(event(1,11,'feature_view','planets','none'));
await denied('a session start must have the first sequence','anon',null,'select record_funnel_event($1::jsonb)',[JSON.stringify(event(1,12,'session_start','news','external'))]);
await record(event(1,1,'session_start','news','external'));
await record(event(1,4,'auth_attempt','board','google'));
check('semantic, write-start, source and sequence dedupe preserve nine rows',await size()===9);
await denied('session audience cannot change after login','anon',null,'select record_funnel_event($1::jsonb)',[JSON.stringify(event(1,10,'auth_attempt','board','google',{audience:'member'}))]);
data=await report();
let m=data.days[0].metrics;
check('received session_start repairs orphan classification',m.sessions===1&&m.events_without_session_start===0&&m.raw_events===9);
check('source and exact allowlisted landing remain immutable',m.sources.google===1&&m.sources.external===0&&m.landing_pages.planets===1);
check('coarse audience is a session count only',m.guest_sessions===1&&m.member_sessions===0);
check('view → ready → use uses occurrence sequence despite request reordering',m.features.planets.view_sessions===1&&m.features.planets.ready_after_view_sessions===1&&m.features.planets.used_after_ready_sessions===1);
check('planet → board numerator pairs with planet-view denominator',m.features.planets.board_after_view_sessions===1&&m.features.planets.view_sessions===1);
check('board → write and write → auth retain raw numerator and denominator',m.write_after_board_sessions===1&&m.board_view_sessions===1&&m.write_start_sessions===1&&m.auth_attempt_after_write_sessions===1&&m.auth_open_after_write_sessions===1);
check('unused feature has zero denominator rather than invented conversion',m.features.calendar.view_sessions===0&&m.features.calendar.used_after_ready_sessions===0&&!JSON.stringify(m).includes('rate'));

// Intent in the wrong order cannot become a funnel success.
await record(event(2,1,'session_start','board','internal',{audience:'member'}));
await record(event(2,2,'auth_attempt','board','google',{audience:'member'}));
await record(event(2,3,'write_start','board','input',{audience:'member'}));
await record(event(2,4,'feature_view','board','none',{audience:'member'}));
await record(event(3,2,'feature_view','calendar','none'));
m=(await report()).days[0].metrics;
check('out-of-order intent is excluded from ordered conversions',m.sessions===2&&m.member_sessions===1&&m.auth_attempt_sessions===2&&m.auth_attempt_after_write_sessions===1&&m.write_after_board_sessions===1);
check('lost session_start remains visible as missing coverage',m.events_without_session_start===1);
await record(event(2,5,'auth_attempt','board','google',{audience:'member'}));
await record(event(2,5,'auth_attempt','board','google',{audience:'member'}));
m=(await report()).days[0].metrics;
check('same authentication method can be observed after writing despite an earlier attempt',m.auth_attempt_sessions===2&&m.auth_attempt_after_write_sessions===2&&m.raw_events===15);
await record(event(4));
await record(event(4,2,'feature_view','planets','none'));
await record(event(4,3,'tool_use','planets','time'));
await record(event(4,4,'tool_ready','planets','none'));
await record(event(4,128,'tool_use','planets','region'));
m=(await report()).days[0].metrics;
check('a later received use after readiness counts despite an earlier use',m.features.planets.used_after_ready_sessions===2);
await db.exec(`reset role; delete from orbit_funnel_private.events where session_id='${sid(4)}'`);
await db.exec('reset role');
const columns=(await db.query(`select column_name from information_schema.columns where table_schema='orbit_funnel_private' and table_name='events' order by ordinal_position`)).rows.map(x=>x.column_name);
check('raw schema contains only the typed contract and server timestamp',columns.join(',')==='session_id,sequence,event,feature,detail,context,page_key,audience,occurred_at');
check('timestamp comes from the server',(await db.query('select bool_and(occurred_at between now()-interval \'5 minutes\' and now()+interval \'1 second\') as ok from orbit_funnel_private.events')).rows[0].ok);

// Complete-day rollup is independent of request ordering and raw retention.
await db.exec(`update orbit_funnel_private.settings set installed_at=now()-interval '45 days';
update orbit_funnel_private.events set occurred_at=occurred_at-interval '1 day';`);
await denied('KST date boundary requires a fresh session UUID','anon',null,'select record_funnel_event($1::jsonb)',[JSON.stringify(event(1,20,'tool_use','planets','region'))]);
let maintenance=(await as('service_role',null,'select maintain_funnel_analytics() as data')).rows[0].data;
check('maintenance finalizes only complete dates and no today row',maintenance.finalized_days===29);
await db.exec('reset role');
let yesterday=(await db.query(`select metrics from orbit_funnel_private.daily where day=${today}-1`)).rows[0].metrics;
check('daily snapshot preserves raw counts, audience and ordered funnel',yesterday.sessions===2&&yesterday.raw_events===15&&yesterday.auth_attempt_after_write_sessions===2);
check('daily aggregate contains no session or Auth identifier',![sid(1),sid(2),A,B,'session_id','user_id','author_id'].some(v=>JSON.stringify(yesterday).includes(v)));
await db.exec(`update orbit_funnel_private.events set occurred_at=now()-interval '31 days';
insert into orbit_funnel_private.daily(day,metrics) values(${today}-400,'{"sentinel":1}');`);
maintenance=(await as('service_role',null,'select maintain_funnel_analytics() as data')).rows[0].data;
check('maintenance actually deletes raw rows older than 30 days and aggregate days beyond 400',maintenance.deleted_raw_events===15&&maintenance.deleted_daily_rows===1&&await size()===0);
await as('service_role',null,'select maintain_funnel_analytics()');
await db.exec('reset role');
check('maintenance rerun never overwrites finalized counts after raw deletion',JSON.stringify((await db.query(`select metrics from orbit_funnel_private.daily where day=${today}-1`)).rows[0].metrics)===JSON.stringify(yesterday));
await db.exec("update orbit_funnel_private.settings set installed_at=now()-interval '1 day'");
data=await report(`${today}-1`,`${today}-1`);
check('installation day remains explicitly partial after finalization',data.days[0].coverage==='partial_installation_day'&&data.days[0].metrics.sessions===2);
await db.exec("reset role; update orbit_funnel_private.settings set installed_at=now()-interval '45 days'");
data=await report(`${today}-40`,`${today}-40`);
check('older absent snapshot is unavailable, not fake zero',data.days[0].coverage==='unavailable'&&data.days[0].metrics===null);
data=await report(`${today}-46`,`${today}-46`);
check('dates before installation are explicitly unavailable',data.days[0].coverage==='before_installation'&&data.days[0].metrics===null);
check('current day is explicitly partial',(await report()).days[0].coverage==='partial_today');
await denied('operator report rejects unbounded old date range','authenticated',ADMIN,`select funnel_report(${today}-400,${today})`);
await denied('operator report rejects future dates','authenticated',ADMIN,`select funnel_report(${today},${today}+1)`);
await denied('operator report rejects null dates','authenticated',ADMIN,'select funnel_report(null,null)');

// Completion reads existing committed database rows, not browser signals.
await db.exec(`reset role;
insert into public.posts(author_id,created_at) values('${A}',now()-interval '7 days'),('${A}',now()-interval '5 days'),('${ADMIN}',now()-interval '1 day'),(null,now()-interval '1 day');
insert into public.reactions(author_id,created_at) values('${A}',now()-interval '4 days'),('${B}',now()-interval '2 days'),('${ADMIN}',now()-interval '1 day'),('${ANON}',now()-interval '1 day'),(null,now()-interval '1 day');
insert into orbit_members_private.rewards(user_id,reward_key,kind) values
('${A}','visit:'||(${today}-6)::text,'visit'),('${A}','visit:'||(${today}-2)::text,'visit'),
('${B}','visit:'||(${today})::text,'visit'),('${ADMIN}','visit:'||(${today}-1)::text,'visit'),
('${A}','first-post','first-post');
insert into public.visits values(${today}-1,5),(${today}-2,4);
`);
await db.exec(`begin; insert into public.comments(author_id) values('${B}'); rollback;`);
let member=(await as('authenticated',ADMIN,`select funnel_member_report(${today}-7,${today}) as data`)).rows[0].data;
check('permanent Auth cohort excludes anonymous and registered admins',member.verified_accounts_in_cohort===2&&member.profiles_in_cohort===2);
check('DB report excludes admin posts and separates legacy NULL authors',member.contributions.post.retained_rows===3&&member.contributions.post.verified_member_rows===1&&member.contributions.post.legacy_null_author_rows===1);
check('first participation ignores pre-verification anonymous-era rows',member.contributions.post.cohort_first_retained_members===1&&member.contributions.post.cohort_denominator===2);
check('rolled-back failed comment is not a successful participation',member.contributions.comment.retained_rows===0&&member.contributions.comment.cohort_first_retained_members===0);
check('retained reactions separate member and legacy contributions',member.contributions.reaction.retained_rows===4&&member.contributions.reaction.verified_member_rows===2&&member.contributions.reaction.legacy_null_author_rows===1);
check('cohort first-any counts members without joining browser sessions',member.cohort_first_any_members===2);
check('member return uses prior KST date receipts with count denominator',member.member_visit_days===3&&member.visiting_members===2&&member.members_with_prior_date===1);
check('legacy counter remains a separate device-day sum with coverage',member.legacy_daily_counter_sum===9&&member.legacy_days_present===2);
check('operator report never returns member identifiers',![A,B,ADMIN,ANON,'user_id','author_id'].some(v=>JSON.stringify(member).includes(v)));
await db.exec(`reset role; delete from public.posts where author_id='${A}'; delete from public.reactions where author_id='${B}';`);
member=(await as('service_role',null,`select funnel_member_report(${today}-7,${today}) as data`)).rows[0].data;
check('deleted post and canceled reaction no longer appear as retained completion',member.contributions.post.cohort_first_retained_members===0&&member.contributions.reaction.cohort_first_retained_members===1);
check('first-post rewards do not substitute for deleted successful rows',member.contributions.post.retained_rows===1&&member.contributions.post.first_retained_members_in_period===0);
await denied('member report rejects more than 366 days','authenticated',ADMIN,`select funnel_member_report(${today}-366,${today})`);
await db.exec(`reset role; update orbit_members_private.profiles set deleting_at=now() where user_id='${B}'`);
member=(await as('authenticated',ADMIN,`select funnel_member_report(${today}-7,${today}) as data`)).rows[0].data;
check('withdrawing profiles are excluded from member cohort and return',member.verified_accounts_in_cohort===1&&member.visiting_members===1);
await db.close();
console.log(`Funnel DB: ${checks} checks passed`);

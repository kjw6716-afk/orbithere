// Real PostgreSQL in WASM: no requests to Supabase and no production views.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migrationDir = new URL('../supabase/migrations/', import.meta.url);
const filename = readdirSync(migrationDir).find(name => name.endsWith('_story_view_analytics.sql'));
assert.ok(filename, 'story view migration is present');
const migration = readFileSync(new URL(filename, migrationDir), 'utf8');
const db = new PGlite();
let checks = 0;
const check = (label, result) => { assert.ok(result, label); checks++; console.log('✓ ' + label); };
const sid = n => 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(n).padStart(12, '0');
const ADMIN = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
await db.exec(`
  create role anon; create role authenticated; create role service_role; create role unrelated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  create table public.admins(user_id uuid primary key);
  insert into public.admins values('${ADMIN}');
  -- Simulate broad project defaults so the migration must explicitly revoke.
  alter default privileges grant all on tables to anon, authenticated, service_role;
  alter default privileges grant execute on functions to anon, authenticated, service_role;
  create schema cron;
  create table cron.jobs(name text primary key, schedule text, command text);
  create function cron.schedule(p_name text, p_schedule text, p_command text)
  returns bigint language plpgsql as $$ begin
    insert into cron.jobs values(p_name, p_schedule, p_command)
      on conflict(name) do update set schedule = excluded.schedule, command = excluded.command;
    return 1;
  end $$;
`);
await db.exec(migration);
await db.exec(`
  insert into orbit_story_private.catalogue(story_id, published_on) values
    ('moon-example', (now() at time zone 'Asia/Seoul')::date),
    ('mars-example', (now() at time zone 'Asia/Seoul')::date - 10),
    ('future-example', (now() at time zone 'Asia/Seoul')::date + 1);
`);
const started = (await db.query("select tracking_started_at from orbit_story_private.catalogue where story_id='moon-example'")).rows[0].tracking_started_at;
await db.exec(migration);
check('migration rerun preserves collection start', (await db.query("select tracking_started_at from orbit_story_private.catalogue where story_id='moon-example'")).rows[0].tracking_started_at.getTime() === started.getTime());
check('migration schedules one hourly owner purge', (await db.query("select * from cron.jobs where name='orbit-story-view-retention' and schedule='7 * * * *' and command='select orbit_story_private.purge_recent_views()'")).rows.length === 1);
check('all private tables have RLS and no policies', (await db.query(`
  select count(*) as n from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='orbit_story_private' and c.relkind='r' and c.relrowsecurity
    and not exists(select 1 from pg_policy p where p.polrelid=c.oid)
`)).rows[0].n === 3);
check('public RPC is invoker with empty search_path', (await db.query(`
  select not prosecdef and proconfig @> array['search_path=""'] as ok
  from pg_proc where oid='public.record_story_view(text,uuid)'::regprocedure
`)).rows[0].ok);
check('all private helpers pin an empty search_path', (await db.query(`
  select bool_and(proconfig @> array['search_path=""']) as ok from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='orbit_story_private'
`)).rows[0].ok);

async function as(role, sql, values = [], { id = '', headers = {} } = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.headers',$2,false)", [id, JSON.stringify(headers)]);
  await db.exec('set role ' + role);
  return db.query(sql, values);
}
async function owner(sql, values = []) { await db.exec('reset role'); return db.query(sql, values); }
async function denied(label, role, sql, values = [], opts) {
  await assert.rejects(() => as(role, sql, values, opts)); checks++; console.log('✓ ' + label);
}
async function record(story, session, role = 'anon', opts) {
  return (await as(role, 'select public.record_story_view($1,$2::uuid) as counted', [story, session], opts)).rows[0].counted;
}
async function total(story = 'moon-example') {
  return Number((await owner('select coalesce(sum(views),0) as n from orbit_story_private.daily where story_id=$1', [story])).rows[0].n);
}
for (const role of ['anon', 'authenticated', 'service_role']) {
  for (const table of ['catalogue', 'daily', 'recent_views']) {
    await denied(role + ' cannot read ' + table, role, 'select * from orbit_story_private.' + table);
    await denied(role + ' cannot delete ' + table, role, 'delete from orbit_story_private.' + table);
  }
  await denied(role + ' cannot invoke owner purge', role, 'select orbit_story_private.purge_recent_views()');
}
await denied('anon cannot register a new article', 'anon', "insert into orbit_story_private.catalogue(story_id,published_on) values('fake-story',current_date)");
await denied('member cannot alter an aggregate', 'authenticated', 'update orbit_story_private.daily set views=1000000');
await denied('unrelated role has no inherited collector grant', 'unrelated', 'select public.record_story_view($1,$2::uuid)', ['moon-example', sid(1)]);
await denied('unrelated role has no private helper grant', 'unrelated', 'select orbit_story_private.record_view($1,$2::uuid)', ['moon-example', sid(1)]);

for (const [story, session] of [
  ['unknown-story', sid(1)], ['future-example', sid(1)], [null, sid(1)], ['', sid(1)],
  ['moon-example?email=private', sid(1)], ['a'.repeat(71), sid(1)], ['Moon-example', sid(1)],
  ['moon--example', sid(1)], ['moon-example', null], ['moon-example', 'not-a-uuid'],
  ['moon-example', 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa'],
]) await denied('invalid or unpublished input rejected: ' + String(story), 'anon', 'select public.record_story_view($1,$2::uuid)', [story, session]);
check('invalid requests never add counts', await total() === 0);
check('anonymous published story view is counted', await record('moon-example', sid(1)) === true);
check('same story / session / KST day retry is not counted', await record('moon-example', sid(1)) === false);
check('duplicate retry leaves count at one', await total() === 1);
check('same session on another story is independently counted', await record('mars-example', sid(1)) === true && await total('mars-example') === 1);
check('another session adds one view', await record('moon-example', sid(2)) === true && await total() === 2);
check('signed-in non-admin can use the same bounded collector', await record('moon-example', sid(3), 'authenticated', { id: MEMBER }) === true);
check('authenticated administrator is excluded', await record('moon-example', sid(4), 'authenticated', { id: ADMIN }) === false);
await denied('account UUID cannot be repurposed as session UUID', 'authenticated', 'select public.record_story_view($1,$2::uuid)', ['moon-example', MEMBER], { id: MEMBER });
check('administrator and malformed account ID add no counts', await total() === 3);
const tokens = (await owner("select encode(token,'hex') as token from orbit_story_private.recent_views where story_id in ('moon-example','mars-example')")).rows.map(r => r.token);
check('article-separated SHA256 tokens are 32 bytes', tokens.every(t => /^[0-9a-f]{64}$/.test(t)) && new Set(tokens).size === 4);
const columns = (await owner("select table_name,column_name from information_schema.columns where table_schema='orbit_story_private' order by table_name,ordinal_position")).rows;
check('stored columns contain only catalogue, date, count and hash', JSON.stringify(columns.map(x => x.column_name)) === JSON.stringify(['story_id','published_on','tracking_started_at','day','story_id','views','day','story_id','token']));

for (const headers of [
  { origin: 'https://preview.example.test' }, { 'user-agent': 'Googlebot/2.1' },
  { 'user-agent': 'HeadlessChrome/130' }, { 'x-orbit-test': '1' },
  { purpose: 'prefetch' }, { 'sec-purpose': 'prefetch;prerender' },
]) check('known preview / bot / QA request excluded', await record('moon-example', sid(5), 'anon', { headers }) === false);
check('excluded request adds no counts', await total() === 3);
check('ordinary production-origin browser is accepted', await record('moon-example', sid(5), 'anon', { headers: { origin: 'https://orbithere.com', 'user-agent': 'Mozilla/5.0 Chrome/130' } }) === true);

// A surrounding rollback must undo BOTH the aggregate and duplicate token.
await db.exec('reset role; begin');
await db.query("select set_config('request.jwt.claim.sub','',true), set_config('request.headers','{}',true)");
await db.exec('set local role anon');
check('transaction smoke call can insert', (await db.query('select public.record_story_view($1,$2::uuid) as counted', ['moon-example', sid(10)])).rows[0].counted);
await db.exec('rollback');
check('rollback leaves no fake production count', await total() === 4);
check('rolled-back token did not poison a later retry', await record('moon-example', sid(10)) === true && await total() === 5);

// KST day is server-derived, independent of the database session timezone.
await db.exec("reset role; set timezone='America/Los_Angeles'");
check('another session counts with a non-KST DB timezone', await record('moon-example', sid(11)) === true);
check('stored date follows KST, not session timezone', (await owner("select bool_and(day=(clock_timestamp() at time zone 'Asia/Seoul')::date) as ok from orbit_story_private.daily")).rows[0].ok);
await db.exec('reset role');
await db.exec(`
  insert into orbit_story_private.recent_views(day,story_id,token)
    select (now() at time zone 'Asia/Seoul')::date + offset_days, 'moon-example', sha256(convert_to(offset_days::text,'UTF8'))
    from (values(-2),(-1)) as dates(offset_days);
  insert into orbit_story_private.daily(day,story_id,views)
    values((now() at time zone 'Asia/Seoul')::date-1000,'moon-example',12);
`);
check('owner purge removes only tokens older than two KST dates', Number((await owner('select orbit_story_private.purge_recent_views() as n')).rows[0].n) === 1);
check('previous KST day tokens remain for retry safety', Number((await owner("select count(*) as n from orbit_story_private.recent_views where day=(now() at time zone 'Asia/Seoul')::date-1")).rows[0].n) === 1);
check('old anonymous aggregate is retained for cumulative totals', Number((await owner("select views from orbit_story_private.daily where day=(now() at time zone 'Asia/Seoul')::date-1000")).rows[0].views) === 12);
await db.exec(`insert into orbit_story_private.recent_views(day,story_id,token)
  values((now() at time zone 'Asia/Seoul')::date-3,'moon-example',sha256(convert_to('expired','UTF8')))`);
await record('moon-example', sid(12));
check('valid writes opportunistically purge expired dedup tokens', Number((await owner("select count(*) as n from orbit_story_private.recent_views where day<(now() at time zone 'Asia/Seoul')::date-1")).rows[0].n) === 0);
await assert.rejects(() => owner("update orbit_story_private.daily set views=-1 where story_id='moon-example'"));
check('daily count cannot be negative', true);

// Execute the actual owner report against known windows and KST boundaries.
// These synthetic aggregates exist only inside this local WASM database.
const reportSql = readFileSync(new URL('../supabase/story_views_report.sql', import.meta.url), 'utf8');
await db.exec('reset role');
await db.exec(`
  insert into orbit_story_private.catalogue(story_id, published_on, tracking_started_at)
  select story_id, today - published_days_ago,
    ((today - tracking_days_ago)::timestamp + tracking_hour * interval '1 hour') at time zone 'Asia/Seoul'
  from (select (now() at time zone 'Asia/Seoul')::date as today) b cross join (values
    ('report-full', 31, 30, 0),
    ('report-partial-yesterday', 2, 1, 12),
    ('report-starts-today', 2, 0, 0),
    ('report-boundary-yesterday', 1, 1, 0),
    ('report-boundary-week', 8, 7, 0),
    ('report-boundary-previous-week', 15, 14, 0),
    ('report-partial-previous-week', 11, 10, 6),
    ('report-published-today', 0, 0, 0),
    ('report-published-future', -1, 0, 0),
    ('report-zero', 40, 30, 0)
  ) f(story_id, published_days_ago, tracking_days_ago, tracking_hour);
  insert into orbit_story_private.daily(day, story_id, views)
  select (now() at time zone 'Asia/Seoul')::date - days_ago, 'report-full', days_ago
    from generate_series(1,14) days_ago;
  insert into orbit_story_private.daily(day, story_id, views) values
    ((now() at time zone 'Asia/Seoul')::date - 15, 'report-full', 1000),
    ((now() at time zone 'Asia/Seoul')::date, 'report-full', 9999),
    ((now() at time zone 'Asia/Seoul')::date + 1, 'report-full', 8888),
    ((now() at time zone 'Asia/Seoul')::date - 1, 'report-partial-yesterday', 3),
    ((now() at time zone 'Asia/Seoul')::date, 'report-starts-today', 10);
`);
const reportRows = (await owner(reportSql)).rows;
const reports = Object.fromEntries(reportRows.map(row => [row.story_id, row]));
const coverage = story => ['yesterday_coverage', 'last_7d_coverage', 'previous_7d_coverage'].map(key => reports[story][key]);
const equal = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
check('report yesterday and prior day use their exact KST dates', reports['report-full'].yesterday_views === 1 && reports['report-full'].previous_day_views === 2);
check('report current seven closed days include both boundaries', reports['report-full'].last_7d_views === 28);
check('report previous seven days are disjoint and include day fourteen', reports['report-full'].previous_7d_views === 77);
check('report cumulative includes older days and excludes today/future', reports['report-full'].cumulative_views === 1105);
check('report labels full coverage across all three windows', equal(coverage('report-full'), ['tracked', 'tracked', 'tracked']));
check('midday installation marks yesterday and last week partial', equal(coverage('report-partial-yesterday'), ['partial', 'partial', 'not_started']));
check('partial coverage preserves actually collected views', reports['report-partial-yesterday'].yesterday_views === 3 && reports['report-partial-yesterday'].last_7d_views === 3);
check('today installation is not confused with measured zero yesterday', equal(coverage('report-starts-today'), ['not_started', 'not_started', 'not_started']) && reports['report-starts-today'].cumulative_views === 0);
check('exact start of yesterday gives complete yesterday coverage', equal(coverage('report-boundary-yesterday'), ['tracked', 'partial', 'not_started']));
check('exact seven-day boundary covers last week but not previous week', equal(coverage('report-boundary-week'), ['tracked', 'tracked', 'not_started']));
check('exact fourteen-day boundary covers both seven-day windows', equal(coverage('report-boundary-previous-week'), ['tracked', 'tracked', 'tracked']));
check('mid-previous-week installation marks only previous week partial', equal(coverage('report-partial-previous-week'), ['tracked', 'tracked', 'partial']));
check('zero-view tracked article remains visible with real zero counts', equal(coverage('report-zero'), ['tracked', 'tracked', 'tracked']) && ['yesterday_views','previous_day_views','last_7d_views','previous_7d_views','cumulative_views'].every(key => reports['report-zero'][key] === 0));
check('today and future publications are outside the yesterday cutoff', !reports['report-published-today'] && !reports['report-published-future']);
check('report ranks by the latest seven complete days', reportRows[0].story_id === 'report-full' && reportRows[1].story_id === 'report-partial-yesterday');
const kstReportDay = (await owner("select (now() at time zone 'Asia/Seoul')::date-1 as day")).rows[0].day;
check('report date follows KST even with a non-KST session timezone', reportRows.every(row => row.report_day.getTime() === kstReportDay.getTime()));
check('report result contains only public article metadata and aggregates', reportRows.every(row => equal(Object.keys(row), ['story_id','published_on','tracking_started_kst','report_day','yesterday_views','previous_day_views','last_7d_views','previous_7d_views','cumulative_views','yesterday_coverage','last_7d_coverage','previous_7d_coverage'])));
await denied('anonymous cannot execute the owner aggregate SELECT', 'anon', reportSql);
await denied('ordinary member cannot execute the owner aggregate SELECT', 'authenticated', reportSql, [], { id: MEMBER });
await db.close();
console.log(`\n${checks} story view database checks passed.`);

// Execute the actual migrations against PostgreSQL in WASM. Nothing touches the live DB.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const sql = (p) => readFileSync(new URL('../supabase/' + p, import.meta.url), 'utf8');
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222',
  ADMIN = '33333333-3333-4333-8333-333333333333';
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated;
insert into auth.users values ('${A}'),('${B}'),('${ADMIN}');`);
// Minimal Storage metadata fixture; real bytes are tested through the API client.
await db.exec(`create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text references storage.buckets(id),name text not null,created_at timestamptz default now(),unique(bucket_id,name));
create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to anon,authenticated;`);
// Match Supabase's default grants (RLS then restricts them).
await db.exec(`alter default privileges in schema public grant all on tables to anon,authenticated;
alter default privileges in schema public grant all on sequences to anon,authenticated;`);
for (const name of [
  'schema.sql',
  'migration_002_delete.sql',
  'migration_003_rate_limit.sql',
  'migration_004_comments.sql',
  'migration_005_admin.sql',
  'migration_006_pet_orbit.sql',
  'migration_007_reports.sql',
  'migration_008_sky_orbits.sql',
  'migration_009_visits.sql',
  'migration_010_visit_guard.sql',
]) {
  await db.exec(sql(name));
}
const legacy = (
  await db.query(
    `insert into posts(nick,orbit,text,author_device) values ('이전','report','legacy content','public-device') returning id`,
  )
).rows[0].id;
await db.exec(`insert into admins(user_id) values('${ADMIN}');`);
await db.exec(sql('migration_011_authenticated_ownership.sql'));
// The migration must also be safe to rerun.
await db.exec(sql('migration_011_authenticated_ownership.sql'));
for (const name of readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .filter((n) => n.endsWith('.sql'))
  .sort()) {
  await db.exec(sql('migrations/' + name));
  await db.exec(sql('migrations/' + name));
}
async function as(role, id, query) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id || '']);
  await db.exec('set role ' + role);
  return db.query(query);
}
let count = 0;
const check = (name, condition) => {
  assert.ok(condition, name);
  count++;
  console.log('✓ ' + name);
};
async function denied(name, role, id, query) {
  await assert.rejects(() => as(role, id, query));
  count++;
  console.log('✓ ' + name);
}
check(
  'public reading remains available',
  (await as('anon', null, `select id,nick,text from posts where id='${legacy}'`)).rows.length === 1,
);
await denied(
  'old device identifiers cannot be read',
  'anon',
  null,
  'select author_device from posts',
);
await denied(
  'unauthenticated insert is rejected',
  'anon',
  null,
  `insert into posts(nick,orbit,text,author_device) values('공격','report','x','public-device')`,
);
const post = (
  await as(
    'authenticated',
    A,
    `insert into posts(nick,orbit,text,author_device,created_at) values('관측','report','mine','forged-device','2000-01-01') returning id,author_id,created_at`,
  )
).rows[0];
check(
  'server binds the writer and timestamp',
  post.author_id === A && new Date(post.created_at).getFullYear() > 2025,
);
await denied(
  'forging another writer is rejected',
  'authenticated',
  B,
  `insert into posts(nick,orbit,text,author_device,author_id) values('공격','report','x','forged-device','${A}')`,
);
check(
  'another user cannot delete through REST',
  (await as('authenticated', B, `delete from posts where id='${post.id}' returning id`)).rows
    .length === 0,
);
await as('authenticated', B, `select delete_post('${post.id}','${A}')`);
check(
  'a public identifier cannot authorize old RPC deletion',
  (await as('anon', null, `select id from posts where id='${post.id}'`)).rows.length === 1,
);
await denied(
  'old RPC is unavailable to unauthenticated callers',
  'anon',
  null,
  `select delete_post('${post.id}','${A}')`,
);
await as('authenticated', B, `select delete_post('${legacy}','public-device')`);
check(
  'legacy public token cannot claim old content',
  (await as('anon', null, `select id from posts where id='${legacy}'`)).rows.length === 1,
);
const comment = (
  await as(
    'authenticated',
    A,
    `insert into comments(post_id,nick,text,author_device) values('${post.id}','관측','reply','forged-device') returning id`,
  )
).rows[0].id;
await as('authenticated', B, `select delete_comment('${comment}','${A}')`);
check(
  'another user cannot delete a comment',
  (await as('anon', null, `select id from comments where id='${comment}'`)).rows.length === 1,
);
await denied(
  'comment device identifiers cannot be read',
  'authenticated',
  B,
  'select author_device from comments',
);
await as(
  'authenticated',
  A,
  `insert into reactions(post_id,emoji,device_id) values('${post.id}','⭐','forged-device')`,
);
check(
  'reaction owner is derived from auth',
  (
    await as(
      'authenticated',
      A,
      `select * from reaction_summary(array['${post.id}']::uuid[],'anything')`,
    )
  ).rows[0].mine === true,
);
await as('authenticated', B, `select delete_reaction('${post.id}','⭐','${A}')`);
const summary = (
  await as('authenticated', B, `select * from reaction_summary(array['${post.id}']::uuid[],'${A}')`)
).rows[0];
check(
  'forged reaction identity cannot read ownership or cancel',
  summary.mine === false && Number(summary.n) === 1,
);
await as('authenticated', A, `select delete_reaction('${post.id}','⭐','ignored')`);
check(
  'owner can cancel reaction',
  (await as('anon', null, `select * from reaction_summary(array['${post.id}']::uuid[],null)`)).rows
    .length === 0,
);
await as(
  'authenticated',
  A,
  `insert into posts(nick,orbit,text,author_device) values('관측','report','two','rotated-device')`,
);
await as(
  'authenticated',
  A,
  `insert into posts(nick,orbit,text,author_device) values('관측','report','three','another-device')`,
);
await denied(
  'changing device ID or backdating cannot bypass rate limit',
  'authenticated',
  A,
  `insert into posts(nick,orbit,text,author_device,created_at) values('관측','report','four','different-device','2000-01-01')`,
);
check(
  'owner can delete own comment',
  (await as('authenticated', A, `delete from comments where id='${comment}' returning id`)).rows
    .length === 1,
);
check(
  'owner can delete own post',
  (await as('authenticated', A, `delete from posts where id='${post.id}' returning id`)).rows
    .length === 1,
);
check(
  'administrator retains legacy moderation',
  (await as('authenticated', ADMIN, `delete from posts where id='${legacy}' returning id`)).rows
    .length === 1,
);
await as(
  'authenticated',
  A,
  `insert into reports(target_type,target_id,reason,detail,reporter_device) values('post','${post.id}','etc','private deletion request','ignored-device')`,
);
check(
  'private requests are hidden from public readers',
  (await as('anon', null, 'select detail from reports')).rows.length === 0,
);
check(
  'private requests are hidden from other writers',
  (await as('authenticated', B, 'select detail from reports')).rows.length === 0,
);
check(
  'a reporter cannot read the moderator inbox',
  (await as('authenticated', A, 'select detail from reports')).rows.length === 0,
);
check(
  'administrator can read the private request',
  (await as('authenticated', ADMIN, 'select detail from reports')).rows[0].detail ===
    'private deletion request',
);
await denied(
  'deleting a post does not reset its write limit',
  'authenticated',
  A,
  `insert into posts(nick,orbit,text) values('관측','report','deleted then reposted')`,
);
await denied(
  'write history is inaccessible to public readers',
  'anon',
  null,
  'select * from orbit_private.write_events',
);
await denied(
  'writers cannot change their write history',
  'authenticated',
  A,
  `delete from orbit_private.write_events where actor='${A}'`,
);
await denied(
  'anonymous callers cannot access the moderator RPC',
  'anon',
  null,
  'select * from report_queue()',
);
await denied(
  'anonymous callers cannot access visit statistics',
  'anon',
  null,
  'select * from visit_stats()',
);
check(
  'non-admin authenticated callers cannot read the moderator RPC',
  (await as('authenticated', B, 'select * from report_queue()')).rows.length === 0,
);
await denied(
  'non-admin authenticated callers cannot resolve reports',
  'authenticated',
  B,
  `select resolve_report('${post.id}',true)`,
);
check(
  'administrator retains the moderator RPC',
  (await as('authenticated', ADMIN, 'select * from report_queue()')).rows.length === 1,
);
check(
  'trigger-only functions have no API execute grant',
  (
    await as(
      'authenticated',
      A,
      `select has_function_privilege('authenticated','public.posts_rate_limit()','execute') as allowed`,
    )
  ).rows[0].allowed === false,
);

// A single bulk statement must not sidestep the limit, and rejected writes must
// not consume quota. Real parallel transactions are serialized by the DB lock;
// PGlite is single-connection, so this test does not claim a concurrency load test.
await denied(
  'a bulk insert cannot bypass the per-minute limit',
  'authenticated',
  B,
  `insert into posts(nick,orbit,text) select '관측','report','bulk '||g from generate_series(1,4) g`,
);
await db.exec('reset role');
check(
  'a rejected statement rolls back all content and quota',
  (
    await db.query(
      `select (select count(*) from posts where author_id='${B}') + (select count(*) from orbit_private.write_events where actor='${B}' and kind='posts') as n`,
    )
  ).rows[0].n === 0,
);
const second = (
  await as(
    'authenticated',
    B,
    `insert into posts(nick,orbit,text) values('관측','report','after rollback') returning id`,
  )
).rows[0].id;
for (let i = 0; i < 5; i++) {
  const id = (
    await as(
      'authenticated',
      B,
      `insert into comments(post_id,nick,text) values('${second}','관측','reply') returning id`,
    )
  ).rows[0].id;
  await as('authenticated', B, `delete from comments where id='${id}'`);
}
await denied(
  'deleting comments does not reset their write limit',
  'authenticated',
  B,
  `insert into comments(post_id,nick,text) values('${second}','관측','sixth reply')`,
);
await db.exec('reset role');
// Move only test ledger timestamps; no waiting and no live data mutation.
await db.exec(`update orbit_private.write_events set occurred_at=now()-interval '2 minutes' where actor='${B}';
insert into orbit_private.write_events(actor,kind,source_id,occurred_at)
select '${B}','posts',gen_random_uuid(),now()-interval '2 minutes' from generate_series(1,19);`);
await denied(
  'hourly limit remains after minute window expires',
  'authenticated',
  B,
  `insert into posts(nick,orbit,text) values('관측','report','hourly excess')`,
);
await db.exec('reset role');
await db.exec(
  `update orbit_private.write_events set occurred_at=now()-interval '2 hours' where actor='${B}';`,
);
await as(
  'authenticated',
  B,
  `insert into posts(nick,orbit,text) values('관측','report','new window')`,
);
await db.exec('reset role');
check(
  'expired ledger rows are removed on the next successful write',
  (
    await db.query(
      `select count(*) as n from orbit_private.write_events where occurred_at < now()-interval '1 hour'`,
    )
  ).rows[0].n === 0,
);
// Title board and Storage ownership gates, using real PostgreSQL RLS.
await db.exec('reset role');
await db.exec('delete from orbit_private.write_events');
check(
  'old bodies survive title backfill',
  (await as('anon', null, `select count(*) as n from posts where title is null or title=''`))
    .rows[0].n === 0,
);
check(
  'board capabilities are readable without signup',
  (await as('anon', null, 'select board_version() as n')).rows[0].n === 1,
);
await denied(
  'anonymous readers cannot reserve uploads',
  'anon',
  null,
  `select reserve_board_images(gen_random_uuid(),1)`,
);
await denied(
  'null photo count is rejected',
  'authenticated',
  A,
  `select reserve_board_images(gen_random_uuid(),null)`,
);
await denied(
  'six photos cannot be reserved',
  'authenticated',
  A,
  `select reserve_board_images(gen_random_uuid(),6)`,
);
const photoPost = '77777777-7777-4777-8777-777777777777';
const path = (
  await as('authenticated', A, `select reserve_board_images('${photoPost}',1) as paths`)
).rows[0].paths[0];
const thumb = path.replace('.jpg', '.thumb.jpg');
check(
  'reservation retry returns identical immutable paths',
  (await as('authenticated', A, `select reserve_board_images('${photoPost}',1) as paths`)).rows[0]
    .paths[0] === path,
);
await denied(
  'other writers cannot reserve the same post',
  'authenticated',
  B,
  `select reserve_board_images('${photoPost}',1)`,
);
await denied(
  'a forged upload path is rejected',
  'authenticated',
  A,
  `insert into storage.objects(bucket_id,name) values('board-images','${A}/unreserved.jpg')`,
);
await denied(
  'another writer cannot upload into a reservation',
  'authenticated',
  B,
  `insert into storage.objects(bucket_id,name) values('board-images','${path}')`,
);
await as(
  'authenticated',
  A,
  `insert into storage.objects(bucket_id,name) values('board-images','${path}')`,
);
check(
  'an unpublished photo is private',
  (await as('anon', null, `select name from storage.objects where name='${path}'`)).rows.length ===
    0,
);
check(
  'another writer cannot see unpublished photos',
  (await as('authenticated', B, `select name from storage.objects where name='${path}'`)).rows
    .length === 0,
);
check(
  'the owner can preview an unpublished photo',
  (await as('authenticated', A, `select name from storage.objects where name='${path}'`)).rows
    .length === 1,
);
const publish = `select create_board_post('${photoPost}','사진가','제목 50%_별빛','report','원문 내용',array['${path}'],false)`;
await denied('a missing thumbnail prevents partial publication', 'authenticated', A, publish);
await as(
  'authenticated',
  A,
  `insert into storage.objects(bucket_id,name) values('board-images','${thumb}')`,
);
await as('authenticated', A, publish);
check(
  'a lost response retry does not duplicate a post',
  (await as('authenticated', A, publish)).rows.length === 1,
);
check(
  'published photos are readable without signup',
  (await as('anon', null, `select name from storage.objects where name in ('${path}','${thumb}')`))
    .rows.length === 2,
);
check(
  'the owner cannot delete an attached photo',
  (await as('authenticated', A, `delete from storage.objects where name='${path}' returning name`))
    .rows.length === 0,
);
check(
  'published files cannot be overwritten',
  (
    await as(
      'authenticated',
      A,
      `update storage.objects set name='other' where name='${path}' returning name`,
    )
  ).rows.length === 0,
);
await denied(
  'another writer cannot attach someone else’s photo',
  'authenticated',
  B,
  `select create_board_post(gen_random_uuid(),'다른별','도용','report','사진',array['${path}'],false)`,
);
await denied(
  'empty new titles cannot publish',
  'authenticated',
  A,
  `select create_board_post(gen_random_uuid(),'사진가','','report','내용','{}',false)`,
);
await denied(
  'non-admin cannot publish a forged pin',
  'authenticated',
  B,
  `select create_board_post(gen_random_uuid(),'다른별','위조 공지','report','내용','{}',true)`,
);
check(
  'non-admin pin update has no effect',
  (
    await as(
      'authenticated',
      B,
      `update posts set is_pinned=true where id='${photoPost}' returning id`,
    )
  ).rows.length === 0,
);
await as(
  'authenticated',
  B,
  `insert into comments(post_id,nick,text) values('${photoPost}','다른별','댓글')`,
);
const boardRow = (await as('anon', null, `select * from board_posts(p_query=>'50%_')`)).rows;
check(
  'literal title search returns body-free rows with comment count',
  boardRow.length === 1 && Number(boardRow[0].comment_count) === 1 && !('text' in boardRow[0]),
);
check(
  'body content also remains searchable',
  (await as('anon', null, `select id from board_posts(p_query=>'원문 내용')`)).rows.length === 1,
);
await as('authenticated', ADMIN, `update posts set is_pinned=true where id='${photoPost}'`);
check(
  'pinned posts leave the normal list and appear in notices',
  (await as('anon', null, `select id from board_posts(p_pinned=>true)`)).rows.some(
    (r) => r.id === photoPost,
  ) &&
    !(await as('anon', null, `select id from board_posts()`)).rows.some((r) => r.id === photoPost),
);
// Pin old rows including those created before device authentication existed.
const candidates = (
  await as(
    'anon',
    null,
    `select id from posts where id<>'${photoPost}' order by created_at limit 3`,
  )
).rows;
for (const row of candidates.slice(0, 2))
  await as('authenticated', ADMIN, `update posts set is_pinned=true where id='${row.id}'`);
await denied(
  'a fourth pinned notice is rejected',
  'authenticated',
  ADMIN,
  `update posts set is_pinned=true where id='${candidates[2].id}'`,
);
await as('authenticated', ADMIN, `update posts set is_pinned=false where id='${photoPost}'`);
await denied(
  'writers cannot alter title/body via the pin API',
  'authenticated',
  A,
  `update posts set title='changed' where id='${photoPost}'`,
);
await as('authenticated', A, `delete from posts where id='${photoPost}'`);
check(
  'deleted posts immediately revoke public photo access',
  (await as('anon', null, `select name from storage.objects where name='${path}'`)).rows.length ===
    0,
);
check(
  'another writer cannot remove orphaned photos',
  (await as('authenticated', B, `delete from storage.objects where name='${path}' returning name`))
    .rows.length === 0,
);
await db.exec('reset role');
await db.exec(`update storage.objects set created_at=now()-interval '2 days'`);
check(
  'orphan listing is restricted to administrators',
  (await as('authenticated', B, `select * from board_orphan_images()`)).rows.length === 0,
);
check(
  'administrator can find stale orphan photos',
  (await as('authenticated', ADMIN, `select * from board_orphan_images()`)).rows.length === 2,
);
check(
  'administrator can remove orphan bytes through Storage policy',
  (
    await as(
      'authenticated',
      ADMIN,
      `delete from storage.objects where name in ('${path}','${thumb}') returning name`,
    )
  ).rows.length === 2,
);
for (const n of [5, 5, 5, 4])
  await as('authenticated', A, `select reserve_board_images(gen_random_uuid(),${n})`);
await denied(
  'deleted uploads still consume the hourly reservation limit',
  'authenticated',
  A,
  `select reserve_board_images(gen_random_uuid(),1)`,
);
await denied(
  'upload reservations cannot be read through the API',
  'authenticated',
  A,
  `select * from orbit_private.board_uploads`,
);

// Optional observations use the same ownership, image and rate-limit guards.
await db.exec('reset role');
await db.exec(`delete from orbit_private.write_events`);
const observedPost = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
const note = '{"method":"naked-eye","location":"서울 창문","target":"모르겠어요","telescope":"50%_장비"}';
const observedPublish = `select create_observation_post('${observedPost}','첫별','달을 봤어요.','free','달을 봤어요.','{}',false,'${note}'::jsonb)`;
await denied('observation RPC rejects unauthenticated callers', 'anon', null, observedPublish);
await denied('observation RPC requires a valid session', 'authenticated', null, observedPublish);
await as('authenticated', A, observedPublish);
await as('authenticated', A, observedPublish);
const storedNote = (await as('anon', null, `select text,observation,author_id from posts where id='${observedPost}'`)).rows;
check('observation retry preserves a single original body and owner', storedNote.length === 1 && storedNote[0].text === '달을 봤어요.' && storedNote[0].author_id === A && storedNote[0].observation.target === '모르겠어요');
await denied('observation retry cannot change its payload', 'authenticated', A, observedPublish.replace('서울 창문', '부산'));
await denied('another writer cannot claim an observation post', 'authenticated', B, observedPublish);
await denied('observation cannot be edited through the pin API', 'authenticated', A, `update posts set observation='{}' where id='${observedPost}'`);
check('observation values participate in literal search', (await as('anon', null, `select id from board_posts(p_query:='50%_장비')`)).rows.some(r => r.id === observedPost));
check('Korean method labels participate in search', (await as('anon', null, `select id from board_posts(p_query:='맨눈')`)).rows.some(r => r.id === observedPost));
for (const invalid of ['null', '[]', '"text"', '{"location":null}', '{"location":12}', '{"location":{"x":"y"}}', '{"location":"   "}', '{"latitude":"37"}', '{"method":"gps"}', JSON.stringify({location:'별'.repeat(121)})]) {
  await denied('invalid observation rejected: ' + invalid.slice(0,45), 'authenticated', A,
    `select create_observation_post(gen_random_uuid(),'첫별','제목','free','본문','{}',false,'${invalid}'::jsonb)`);
}
await denied('direct inserts cannot bypass observation validation', 'authenticated', B,
  `insert into posts(nick,title,orbit,text,observation) values('다른별','제목','free','본문','{"latitude":"37"}')`);
await denied('new observation RPC cannot attach unowned photos', 'authenticated', B,
  `select create_observation_post(gen_random_uuid(),'다른별','제목','report','본문',array['${path}'],false,'{}')`);
await denied('new observation RPC cannot forge a pin', 'authenticated', B,
  `select create_observation_post(gen_random_uuid(),'다른별','제목','report','본문','{}',true,'{}')`);
check('existing posts remain without optional metadata', (await as('anon', null, `select count(*)::int as n from posts where observation='{}'::jsonb`)).rows[0].n > 0);

// Real SQL view counting: clients cannot set totals or inspect viewer history.
await db.exec('reset role');
const viewPost = (await db.query(`select id from public.posts limit 1`)).rows[0].id;
await denied('unauthenticated view increments are rejected','anon',null,`select record_post_view('${viewPost}')`);
await denied('a role without a valid user cannot increment','authenticated',null,`select record_post_view('${viewPost}')`);
check('first detail view increments once',(await as('authenticated',A,`select record_post_view('${viewPost}') as n`)).rows[0].n===1);
check('retrying and refreshing in 30 minutes do not inflate views',(await as('authenticated',A,`select record_post_view('${viewPost}') as n`)).rows[0].n===1);
check('another viewer increments independently',(await as('authenticated',B,`select record_post_view('${viewPost}') as n`)).rows[0].n===2);
check('public can read only the cumulative count',(await as('anon',null,`select view_count from post_view_counts where post_id='${viewPost}'`)).rows[0].view_count===2);
for (const role of ['anon','authenticated']) {
 await denied(role+' cannot forge a count',role,A,`insert into post_view_counts values('${viewPost}',99999)`);
 await denied(role+' cannot overwrite a count',role,A,`update post_view_counts set view_count=99999`);
 await denied(role+' cannot delete counters',role,A,`delete from post_view_counts`);
 await denied(role+' cannot truncate counters',role,A,`truncate post_view_counts`);
 await denied(role+' cannot inspect viewer records',role,A,`select * from orbit_view_private.recent_views`);
}
await db.exec('reset role');
await db.exec(`update orbit_view_private.recent_views set viewed_at=now()-interval '31 minutes'`);
check('the same viewer counts again after the window expires',(await as('authenticated',A,`select record_post_view('${viewPost}') as n`)).rows[0].n===3);
await db.exec('reset role');
check('expired viewer records are removed while the refreshed record remains',(await db.query(`select viewer_id from orbit_view_private.recent_views`)).rows.every(r=>r.viewer_id===A));
check('deleted or unknown posts do not create views',(await as('authenticated',A,`select record_post_view(gen_random_uuid()) as n`)).rows[0].n===null);
const row=(await as('anon',null,`select * from board_posts(p_pinned:=(select is_pinned from posts where id='${viewPost}')) where id='${viewPost}'`)).rows[0];
check('board list includes the authoritative count without the body',row.view_count===3&&!('text' in row));
await db.exec('reset role');
await db.exec(`delete from auth.users where id='${A}'`);
check('account deletion removes private viewer records but retains totals',(await db.query(`select count(*)::int as n from orbit_view_private.recent_views where viewer_id='${A}'`)).rows[0].n===0&&(await db.query(`select view_count from post_view_counts where post_id='${viewPost}'`)).rows[0].view_count===3);
await db.exec(`delete from posts where id='${viewPost}'`);
check('post deletion cascades to its cumulative count',(await db.query(`select count(*)::int as n from post_view_counts where post_id='${viewPost}'`)).rows[0].n===0);



// Private activity uses verified identities and receipts for exact comment IDs.
await db.exec('reset role');
const C='55555555-5555-4555-8555-555555555555', D='66666666-6666-4666-8666-666666666666', E='77777777-7777-4777-8777-777777777777';
await db.exec(`insert into auth.users values('${C}'),('${D}'),('${E}');`);
async function activityPost(actor, title) {
 return (await as('authenticated',actor,`insert into posts(nick,title,orbit,text) values('활동자','${title}','free','문자 50%_ 기록') returning id`)).rows[0].id;
}
async function activityComment(actor, id, title) {
 return (await as('authenticated',actor,`insert into comments(post_id,nick,text) values('${id}','참여자','${title}') returning id`)).rows[0].id;
}
const mine1=await activityPost(C,'내 첫 글'), mine2=await activityPost(C,'내 공지'), joined=await activityPost(D,'다른 대화');
await as('authenticated',ADMIN,`update posts set is_pinned=true where id='${mine2}'`);
const reply=await activityComment(D,mine1,'다른 사람의 답글');
await activityComment(C,mine1,'내 댓글');
const beforeJoin=await activityComment(D,joined,'참여 전 댓글'), ownJoin=await activityComment(C,joined,'참여'), afterJoin=await activityComment(D,joined,'참여 후 댓글');
await db.exec('reset role');
await db.exec(`update comments set created_at='2026-09-13T01:00:00Z' where id='${beforeJoin}';
 update comments set created_at='2026-09-13T02:00:00Z' where id='${ownJoin}';
 update comments set created_at='2026-09-13T03:00:00Z' where id='${afterJoin}';`);
for(const fn of ["board_activity_posts()","board_activity_summary()",`mark_board_comments_read('${mine1}',array['${reply}']::uuid[])`]) {
 await denied('anonymous role cannot access '+fn.split('(')[0],'anon',null,'select * from '+fn);
 await denied('missing identity cannot access '+fn.split('(')[0],'authenticated',null,'select * from '+fn);
}
const mineRows=(await as('authenticated',C,`select * from board_activity_posts()`)).rows;
check('mine includes only owned posts, including owned pinned posts',mineRows.length===2 && mineRows.every(p=>p.author_id===C) && mineRows.some(p=>p.id===mine2&&p.is_pinned));
const joinedRows=(await as('authenticated',C,`select * from board_activity_posts('joined')`)).rows;
check('participated feed excludes own posts and counts only replies after joining',joinedRows.length===1&&joinedRows[0].id===joined&&joinedRows[0].unread_count===1);
check('own comments are not new replies',mineRows.find(p=>p.id===mine1).unread_count===1);
check('summary counts unread conversations rather than individual comments',(await as('authenticated',C,'select board_activity_summary() as n')).rows[0].n===2);
check('a different signed-in user has an independent empty activity feed',(await as('authenticated',E,'select * from board_activity_posts()')).rows.length===0);
const firstPage=(await as('authenticated',C,`select * from board_activity_posts(p_limit:=1)`)).rows[0];
const nextPage=(await as('authenticated',C,`select * from board_activity_posts(p_before:='${firstPage.created_at.toISOString()}',p_before_id:='${firstPage.id}',p_limit:=1)`)).rows;
check('personal list cursor does not duplicate the previous page',nextPage.length===1&&nextPage[0].id!==firstPage.id);
check('personal search keeps literal wildcard semantics',(await as('authenticated',C,`select id from board_activity_posts(p_query:='50%_')`)).rows.length===2);
await denied('unknown activity scope is rejected','authenticated',C,`select * from board_activity_posts('someone-else')`);
check('unrelated users cannot mark another conversation read',(await as('authenticated',E,`select mark_board_comments_read('${mine1}',array['${reply}']::uuid[]) as n`)).rows[0].n===0);
check('comment IDs from a different post are ignored',(await as('authenticated',C,`select mark_board_comments_read('${mine1}',array['${afterJoin}']::uuid[]) as n`)).rows[0].n===0);
check('a visible reply can be marked once',(await as('authenticated',C,`select mark_board_comments_read('${mine1}',array['${reply}']::uuid[]) as n`)).rows[0].n===1);
check('read receipt retries are idempotent',(await as('authenticated',C,`select mark_board_comments_read('${mine1}',array['${reply}']::uuid[]) as n`)).rows[0].n===0);
check('another account cannot read private receipts',(await as('authenticated',D,'select * from orbit_activity_private.read_comments')).rows.length===0);
check('owner can read only their own receipt',(await as('authenticated',C,'select * from orbit_activity_private.read_comments')).rows.length===1);
for(const statement of [`insert into orbit_activity_private.read_comments values('${D}','${reply}')`, `update orbit_activity_private.read_comments set user_id='${D}'`, 'delete from orbit_activity_private.read_comments', 'truncate orbit_activity_private.read_comments']) {
 await denied('client cannot bypass the read receipt helper: '+statement.split(' ')[0],'authenticated',C,statement);
}
await denied('anonymous users cannot read receipts','anon',null,'select * from orbit_activity_private.read_comments');
await denied('receipt requests have a strict batch bound','authenticated',C,`select mark_board_comments_read('${mine1}',array_fill('${reply}'::uuid,array[51]))`);
const newer=await activityComment(D,mine1,'읽는 도중 새로 달린 답글');
check('acknowledging a snapshot leaves later and unloaded replies unread',(await as('authenticated',C,`select unread_count from board_activity_posts('unread') where id='${mine1}'`)).rows[0].unread_count===1);
await as('authenticated',C,`select mark_board_comments_read('${joined}',array['${afterJoin}']::uuid[])`);
check('read state persists across role and session switches',(await as('authenticated',C,'select board_activity_summary() as n')).rows[0].n===1);
await as('authenticated',D,`delete from comments where id='${reply}'`);
check('comment deletion removes its receipt',(await as('authenticated',C,`select * from orbit_activity_private.read_comments where comment_id='${reply}'`)).rows.length===0);
await as('authenticated',C,`select mark_board_comments_read('${mine1}',array['${newer}']::uuid[])`);
await as('authenticated',C,`delete from posts where id='${mine1}'`);
check('post deletion cascades to its replies and receipts',(await as('authenticated',C,`select * from orbit_activity_private.read_comments where comment_id='${newer}'`)).rows.length===0);
await db.exec('reset role');
await db.exec(`delete from auth.users where id='${C}'`);
check('account deletion removes its private receipts',(await db.query(`select * from orbit_activity_private.read_comments where user_id='${C}'`)).rows.length===0);

await db.close();
console.log(`Security: ${count} checks passed`);

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
await db.close();
console.log(`Security: ${count} checks passed`);

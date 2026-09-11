// Execute the actual migrations against PostgreSQL in WASM. Nothing touches the live DB.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db = new PGlite();
const sql = p => readFileSync(new URL('../supabase/' + p, import.meta.url), 'utf8');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', ADMIN='33333333-3333-4333-8333-333333333333';
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated;
insert into auth.users values ('${A}'),('${B}'),('${ADMIN}');`);
// Match Supabase's default grants (RLS then restricts them).
await db.exec(`alter default privileges in schema public grant all on tables to anon,authenticated;
alter default privileges in schema public grant all on sequences to anon,authenticated;`);
for(const name of ['schema.sql','migration_002_delete.sql','migration_003_rate_limit.sql','migration_004_comments.sql','migration_005_admin.sql','migration_006_pet_orbit.sql','migration_007_reports.sql','migration_008_sky_orbits.sql','migration_009_visits.sql','migration_010_visit_guard.sql']) {
  await db.exec(sql(name));
}
const legacy = (await db.query(`insert into posts(nick,orbit,text,author_device) values ('이전','report','legacy content','public-device') returning id`)).rows[0].id;
await db.exec(`insert into admins(user_id) values('${ADMIN}');`);
await db.exec(sql('migration_011_authenticated_ownership.sql'));
// The migration must also be safe to rerun.
await db.exec(sql('migration_011_authenticated_ownership.sql'));
async function as(role,id,query){
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id||'']);
  await db.exec('set role '+role);
  return db.query(query);
}
let count=0;
const check=(name,condition)=>{assert.ok(condition,name); count++; console.log('✓ '+name);};
async function denied(name,role,id,query){
  await assert.rejects(()=>as(role,id,query)); count++; console.log('✓ '+name);
}
check('public reading remains available',(await as('anon',null,`select id,nick,text from posts where id='${legacy}'`)).rows.length===1);
await denied('old device identifiers cannot be read','anon',null,'select author_device from posts');
await denied('unauthenticated insert is rejected','anon',null,`insert into posts(nick,orbit,text,author_device) values('공격','report','x','public-device')`);
const post=(await as('authenticated',A,`insert into posts(nick,orbit,text,author_device,created_at) values('관측','report','mine','forged-device','2000-01-01') returning id,author_id,created_at`)).rows[0];
check('server binds the writer and timestamp',post.author_id===A && new Date(post.created_at).getFullYear()>2025);
await denied('forging another writer is rejected','authenticated',B,`insert into posts(nick,orbit,text,author_device,author_id) values('공격','report','x','forged-device','${A}')`);
check('another user cannot delete through REST',(await as('authenticated',B,`delete from posts where id='${post.id}' returning id`)).rows.length===0);
await as('authenticated',B,`select delete_post('${post.id}','${A}')`);
check('a public identifier cannot authorize old RPC deletion',(await as('anon',null,`select id from posts where id='${post.id}'`)).rows.length===1);
await denied('old RPC is unavailable to unauthenticated callers','anon',null,`select delete_post('${post.id}','${A}')`);
await as('authenticated',B,`select delete_post('${legacy}','public-device')`);
check('legacy public token cannot claim old content',(await as('anon',null,`select id from posts where id='${legacy}'`)).rows.length===1);
const comment=(await as('authenticated',A,`insert into comments(post_id,nick,text,author_device) values('${post.id}','관측','reply','forged-device') returning id`)).rows[0].id;
await as('authenticated',B,`select delete_comment('${comment}','${A}')`);
check('another user cannot delete a comment',(await as('anon',null,`select id from comments where id='${comment}'`)).rows.length===1);
await denied('comment device identifiers cannot be read','authenticated',B,'select author_device from comments');
await as('authenticated',A,`insert into reactions(post_id,emoji,device_id) values('${post.id}','⭐','forged-device')`);
check('reaction owner is derived from auth',(await as('authenticated',A,`select * from reaction_summary(array['${post.id}']::uuid[],'anything')`)).rows[0].mine===true);
await as('authenticated',B,`select delete_reaction('${post.id}','⭐','${A}')`);
const summary=(await as('authenticated',B,`select * from reaction_summary(array['${post.id}']::uuid[],'${A}')`)).rows[0];
check('forged reaction identity cannot read ownership or cancel',summary.mine===false && Number(summary.n)===1);
await as('authenticated',A,`select delete_reaction('${post.id}','⭐','ignored')`);
check('owner can cancel reaction',(await as('anon',null,`select * from reaction_summary(array['${post.id}']::uuid[],null)`)).rows.length===0);
await as('authenticated',A,`insert into posts(nick,orbit,text,author_device) values('관측','report','two','rotated-device')`);
await as('authenticated',A,`insert into posts(nick,orbit,text,author_device) values('관측','report','three','another-device')`);
await denied('changing device ID or backdating cannot bypass rate limit','authenticated',A,`insert into posts(nick,orbit,text,author_device,created_at) values('관측','report','four','different-device','2000-01-01')`);
check('owner can delete own comment',(await as('authenticated',A,`delete from comments where id='${comment}' returning id`)).rows.length===1);
check('owner can delete own post',(await as('authenticated',A,`delete from posts where id='${post.id}' returning id`)).rows.length===1);
check('administrator retains legacy moderation',(await as('authenticated',ADMIN,`delete from posts where id='${legacy}' returning id`)).rows.length===1);
await db.close();
console.log(`Security: ${count} checks passed`);

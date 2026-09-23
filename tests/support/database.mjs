import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const ids = {
  editor: '11111111-1111-4111-8111-111111111111',
  member: '22222222-2222-4222-8222-222222222222',
  pending: '33333333-3333-4333-8333-333333333333',
  viewer: '44444444-4444-4444-8444-444444444444',
};
export async function testDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant all on storage.objects to authenticated,service_role;
 `);
  const base = await readFile(
    new URL(
      '../../supabase/migrations/20260830000000_www_auth_and_content.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(base.replace('create extension if not exists pgcrypto;', ''));
  await db.exec(
    await readFile(
      new URL(
        '../../supabase/migrations/20260912000000_minimal_publishing.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/20260924000000_paid_month_access.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/20260924000001_member_event_application.sql', import.meta.url),
      'utf8',
    ),
  );
  for (const [role, id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      id,
      role + '@review.invalid',
    ]);
    if (role === 'editor' || role === 'viewer')
      await db.query('update profiles set role=$1 where id=$2', [role, id]);
  }
  await db.query(
    "insert into article_entitlements(user_id,provider_member_id,allowed,verified_at,valid_from,valid_until) values($1,'test-member',true,now(),now()-interval '1 day',now()+interval '1 day')",
    [ids.member],
  );
  return db;
}
/**
 * @template T
 * @param {import('@electric-sql/pglite').PGlite} db
 * @param {string} role
 * @param {string} id
 * @param {(tx: import('@electric-sql/pglite').Transaction) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function asRole(db, role, id, fn) {
  return db.transaction(async (tx) => {
    await tx.exec('set local role ' + role);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      id || '',
    ]);
    return fn(tx);
  });
}

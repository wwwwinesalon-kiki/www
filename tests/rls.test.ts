import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { testDatabase, asRole, ids } from './support/database.mjs';
let db: Awaited<ReturnType<typeof testDatabase>>;
const article = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
beforeAll(async () => {
  db = await testDatabase();
  await db.query(
    "insert into contents(id,type,title,slug,body,publish_status) values($1,'TABLE','検証専用','private-test','PAID_SECRET','published')",
    [article],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe('real PostgreSQL RLS in isolated PGlite', () => {
  it('keeps profile contact fields outside authenticated reads', async () => {
    const visible = await asRole(db, 'authenticated', ids.member, (tx) =>
      tx.query('select id,role,status from profiles where id=$1', [ids.member]),
    );
    expect(visible.rows).toHaveLength(1);
    await expect(
      asRole(db, 'authenticated', ids.member, (tx) =>
        tx.query('select email,name,kaihipay_customer_id from profiles where id=$1', [ids.member]),
      ),
    ).rejects.toThrow();
  });
  it('denies anonymous and unentitled direct SQL body reads', async () => {
    for (const [role, id] of [
      ['anon', ''],
      ['authenticated', ids.pending],
    ]) {
      const r = await asRole(db, role, id, (tx) =>
        tx.query('select body from contents where id=$1', [article]),
      );
      expect(r.rows).toHaveLength(0);
    }
  });
  it('allows entitled members', async () => {
    const r = await asRole(db, 'authenticated', ids.member, (tx) =>
      tx.query('select body from contents where id=$1', [article]),
    );
    expect(r.rows).toHaveLength(1);
  });
  it('denies member mutations, entitlement writes and profile role RPC', async () => {
    const r = await asRole(db, 'authenticated', ids.member, (tx) =>
      tx.query("update contents set title='hacked' where id=$1 returning id", [
        article,
      ]),
    );
    expect(r.rows).toHaveLength(0);
    await expect(
      asRole(db, 'authenticated', ids.member, (tx) =>
        tx.query('update article_entitlements set allowed=true'),
      ),
    ).rejects.toThrow();
    await expect(
      asRole(db, 'authenticated', ids.member, (tx) =>
        tx.query("select admin_update_profile($1,'owner','active')", [
          ids.member,
        ]),
      ),
    ).rejects.toThrow();
  });
  it('drafts are visible only to publishing editors not viewers or members', async () => {
    await asRole(db, 'authenticated', ids.editor, (tx) =>
      tx.query("update contents set publish_status='draft' where id=$1", [
        article,
      ]),
    );
    for (const id of [ids.member, ids.viewer]) {
      const r = await asRole(db, 'authenticated', id, (tx) =>
        tx.query('select body from contents where id=$1', [article]),
      );
      expect(r.rows).toHaveLength(0);
    }
    const r = await asRole(db, 'authenticated', ids.editor, (tx) =>
      tx.query('select body from contents where id=$1', [article]),
    );
    expect(r.rows).toHaveLength(1);
  });
  it('images follow withdrawal and members cannot mint storage URLs', async () => {
    const media = await db.query<{ id: string }>(
      "insert into article_media(article_id,object_path,alt,mime_type,size_bytes) values($1,'test-image','畑','image/png',100) returning id",
      [article],
    );
    await db.query('update contents set cover_image=$1 where id=$2', [
      '/api/media/' + media.rows[0].id,
      article,
    ]);
    const read = () =>
      asRole(db, 'authenticated', ids.member, (tx) =>
        tx.query('select id from article_media where article_id=$1', [article]),
      );
    expect((await read()).rows).toHaveLength(0);
    await db.query(
      "update contents set publish_status='published' where id=$1",
      [article],
    );
    expect((await read()).rows).toHaveLength(1);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('www-article-images','test-image')",
    );
    const direct = await asRole(db, 'authenticated', ids.member, (tx) =>
      tx.query('select * from storage.objects'),
    );
    expect(direct.rows).toHaveLength(0);
  });
  it('new uploads to an already published article stay hidden until saved into it', async () => {
    const media = await db.query<{ id: string }>(
      "insert into article_media(article_id,object_path,alt,mime_type,size_bytes) values($1,'unsaved-image','未公開の画像','image/png',100) returning id",
      [article],
    );
    const r = await asRole(db, 'authenticated', ids.member, (tx) =>
      tx.query('select id from article_media where id=$1', [media.rows[0].id]),
    );
    expect(r.rows).toHaveLength(0);
  });
  it('expired entitlement fails closed without altering contract state', async () => {
    await db.query(
      "update article_entitlements set valid_until=now()-interval '1 minute' where user_id=$1",
      [ids.member],
    );
    const r = await asRole(db, 'authenticated', ids.member, (tx) =>
      tx.query<{ allowed: boolean }>('select has_article_access() as allowed'),
    );
    expect(r.rows[0].allowed).toBe(false);
  });
  it('old authoritative snapshots cannot roll back newer state', async () => {
    await db.query(
      "insert into kaihipay_sync_events(event_id,provider_member_id) values('new','test-member'),('old','test-member')",
    );
    await db.query(
      "select apply_kaihipay_snapshot('new','test-member',false,now(),null,null)",
    );
    await db.query(
      "select apply_kaihipay_snapshot('old','test-member',true,now()-interval '1 hour',now()-interval '1 day',now()+interval '1 day')",
    );
    const r = await db.query<{ allowed: boolean }>(
      'select allowed from article_entitlements where user_id=$1',
      [ids.member],
    );
    expect(r.rows[0].allowed).toBe(false);
  });
});

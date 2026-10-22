import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migration = new URL(
  '../migrations/neon/0001_www_schema.sql',
  import.meta.url,
);
const activation = new URL(
  '../migrations/neon/0002_activate.sql',
  import.meta.url,
);
const owner = '11111111-1111-4111-8111-111111111111';
const member = '22222222-2222-4222-8222-222222222222';
const event = '33333333-3333-4333-8333-333333333333';
const article = '44444444-4444-4444-8444-444444444444';
const media = '55555555-5555-4555-8555-555555555555';

async function newDatabase() {
  const db = new PGlite();
  await db.exec(await readFile(migration, 'utf8'));
  return db;
}

async function seedLegacy(db: PGlite) {
  await db.query(
    "insert into profiles(id,email,name,role,status) values($1,'old-owner@example.test','旧管理者','owner','active'),($2,'old-member@example.test','旧会員','member','active')",
    [owner, member],
  );
  await db.query(
    "insert into events(id,title,slug,start_at,end_at,venue,capacity,publish_status) values($1,'試験会','test-event',now()+interval '2 days',now()+interval '2 days 2 hours','余市',1,'published')",
    [event],
  );
  await db.query(
    "insert into contents(id,type,title,slug,body,publish_status,body_format) values($1,'FIELD','畑の記事','field-story','本文','published','html')",
    [article],
  );
  await db.query(
    "insert into event_applications(event_id,user_id,name,email,line_name,note,application_status) values($1,$2,'旧氏名','old@example.test','旧LINE','旧メモ','cancelled')",
    [event, owner],
  );
  await db.query(
    "insert into article_entitlements(user_id,provider_member_id,allowed,verified_at,valid_from,valid_until) values($1,'kaihi-member',true,now(),now()-interval '1 day',now()+interval '1 day')",
    [member],
  );
  await db.query(
    "insert into article_media(id,article_id,object_path,alt,mime_type,size_bytes) values($1,$2,'articles/private/test.webp','畑','image/webp',123)",
    [media, article],
  );
  await db.query(
    "insert into kaihipay_sync_events(event_id,provider_member_id) values('queued','kaihi-member')",
  );
  await db.query(
    "insert into kaihipay_invitation_jobs(provider_member_id,user_id,status) values('kaihi-member',$1,'sent')",
    [member],
  );
  await db.query(
    "insert into www_auth_links(profile_id,auth_subject,legacy_supabase_user_id,verified_at) values($1,'neon-owner',$1,now()),($2,'neon-member',$2,now())",
    [owner, member],
  );
  await db.query(
    'insert into www_migration_baseline(table_name,expected_rows,expected_fingerprint) select table_name,row_count,fingerprint from www_migration_fingerprints()',
  );
}

async function recordInventory(db: PGlite, paths: string[]) {
  const joined = [...paths]
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
    .join('\n');
  const sqlHash = await db.query<{ hash: string }>(
    "select encode(sha256(convert_to($1::text,'UTF8')),'hex') as hash",
    [joined],
  );
  expect(sqlHash.rows[0].hash).toBe(
    createHash('sha256').update(joined).digest('hex'),
  );
  await db.query(
    'insert into www_media_inventory_checkpoint(singleton,source_bucket,source_object_count,source_keys_md5,source_keys_sha256,verified_at) values(true,$1,$2,$3,$4,now())',
    [
      'www-article-images',
      paths.length,
      createHash('md5').update(joined).digest('hex'),
      createHash('sha256').update(joined).digest('hex'),
    ],
  );
}

describe('Supabase-free Neon migration schema', () => {
  it('uses a lossless PostgreSQL timestamp token for article edits', async () => {
    const db = await newDatabase();
    try {
      await db.query(
        "insert into contents(id,type,title,slug,body,updated_at) values($1,'FIELD','畑','timestamp-version','初稿',$2::timestamptz)",
        [article, '2026-10-22T00:00:00.123456+00:00'],
      );
      const version = await db.query<{ token: string }>(
        'select updated_at::text as token from contents where id=$1', [article],
      );
      const exactToken = version.rows[0].token;
      const saved = await db.query<{ token: string }>(
        "update contents set body='改稿',updated_at=now() where id=$1 and updated_at=$2::timestamptz returning updated_at::text as token",
        [article, exactToken],
      );
      expect(saved.rows).toHaveLength(1);
      const stale = await db.query(
        "update contents set body='古い編集' where id=$1 and updated_at=$2::timestamptz returning id",
        [article, exactToken],
      );
      expect(stale.rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  }, 30000);

  it('preserves legacy data and fails closed until table and private-byte checks pass', async () => {
    const db = await newDatabase();
    try {
      await seedLegacy(db);
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select www_member_access('neon-member') as allowed",
          )
        ).rows[0].allowed,
      ).toBe(false);
      await expect(db.exec(await readFile(activation, 'utf8'))).rejects.toThrow(
        'private_media_not_verified',
      );
      await db.exec('rollback');
      const inactive = await db.query<{ activated_at: string | null }>(
        'select activated_at from www_migration_control',
      );
      expect(inactive.rows[0].activated_at).toBeNull();

      await db.query(
        "insert into www_media_migration_status(media_id,target_object_key,sha256,verified_at) values($1,'articles/private/test.webp',$2,now())",
        [media, 'a'.repeat(64)],
      );
      await expect(db.exec(await readFile(activation, 'utf8'))).rejects.toThrow(
        'private_media_inventory_not_verified',
      );
      await db.exec('rollback');
      await recordInventory(db, []);
      await expect(db.exec(await readFile(activation, 'utf8'))).rejects.toThrow(
        'private_media_inventory_not_verified',
      );
      await db.exec('rollback');
      await db.query(
        'update www_media_inventory_checkpoint set source_object_count=1',
      );
      await expect(db.exec(await readFile(activation, 'utf8'))).rejects.toThrow(
        'private_media_inventory_not_verified',
      );
      await db.exec('rollback');
      await db.query('delete from www_media_inventory_checkpoint');
      await recordInventory(db, ['articles/private/test.webp']);
      await db.exec(await readFile(activation, 'utf8'));
      const old = await db.query<{ name: string; email: string; note: string }>(
        "select name,email,note from event_applications where name='旧氏名'",
      );
      expect(old.rows[0]).toMatchObject({
        name: '旧氏名',
        email: 'old@example.test',
        note: '旧メモ',
      });
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select www_member_access('neon-member') as allowed",
          )
        ).rows[0].allowed,
      ).toBe(true);
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select www_member_access('unknown-subject') as allowed",
          )
        ).rows[0].allowed,
      ).toBe(false);

      // A reversal must not remain accessible until month-end if the daily
      // provider sync stops, and a forged future verification cannot extend it.
      await db.query(
        "update article_entitlements set verified_at=now()-interval '49 hours' where user_id=$1",
        [member],
      );
      expect((await db.query<{ allowed: boolean }>(
        "select www_member_access('neon-member') as allowed",
      )).rows[0].allowed).toBe(false);
      await expect(db.query(
        "select * from www_apply_to_member_event('neon-member',$1)", [event],
      )).rejects.toThrow('membership_required');
      await db.query(
        "update article_entitlements set verified_at=now()+interval '2 minutes' where user_id=$1",
        [member],
      );
      expect((await db.query<{ allowed: boolean }>(
        "select www_member_access('neon-member') as allowed",
      )).rows[0].allowed).toBe(false);
      await db.query(
        'update article_entitlements set verified_at=now() where user_id=$1',
        [member],
      );
      expect((await db.query<{ allowed: boolean }>(
        "select www_member_access('neon-member') as allowed",
      )).rows[0].allowed).toBe(true);

      const booking = await db.query<{ application_status: string }>(
        "select * from www_apply_to_member_event('neon-member',$1)",
        [event],
      );
      expect(booking.rows[0].application_status).toBe('pending');
      const newContact = await db.query<{
        name: string;
        email: string;
        note: string | null;
      }>(
        'select name,email,note from event_applications where user_id=$1 and application_status=$2',
        [member, 'pending'],
      );
      expect(newContact.rows[0]).toMatchObject({
        name: 'WWW会員',
        email: 'not-collected@example.invalid',
        note: null,
      });
      await expect(
        db.query("select * from www_apply_to_member_event('neon-member',$1)", [
          event,
        ]),
      ).rejects.toThrow('already_applied');
      await expect(
        db.query("select * from www_apply_to_member_event('neon-owner',$1)", [
          event,
        ]),
      ).rejects.toThrow('membership_required');
    } finally {
      await db.close();
    }
  }, 30000);

  it('rejects changed rows and stale or unqueued Kaihipay snapshots', async () => {
    const db = await newDatabase();
    try {
      await seedLegacy(db);
      await db.query(
        "insert into www_media_migration_status(media_id,target_object_key,sha256,verified_at) values($1,'articles/private/test.webp',$2,now())",
        [media, 'b'.repeat(64)],
      );
      await recordInventory(db, ['articles/private/test.webp']);
      await db.query("update contents set body='違う本文' where id=$1", [
        article,
      ]);
      await expect(db.exec(await readFile(activation, 'utf8'))).rejects.toThrow(
        'migration_data_mismatch',
      );
      await db.exec('rollback');
      await db.query("update contents set body='本文' where id=$1", [article]);
      await db.exec(await readFile(activation, 'utf8'));
      await expect(
        db.query(
          "select www_apply_kaihipay_snapshot('missing','kaihi-member',false,now(),null,null)",
        ),
      ).rejects.toThrow('queued_event_required');
      await db.query(
        "select www_apply_kaihipay_snapshot('queued','kaihi-member',false,now(),null,null)",
      );
      await db.query(
        "insert into kaihipay_sync_events(event_id,provider_member_id) values('stale','kaihi-member')",
      );
      await db.query(
        "select www_apply_kaihipay_snapshot('stale','kaihi-member',true,now()-interval '1 hour',now()-interval '1 day',now()+interval '1 day')",
      );
      const entitlement = await db.query<{ allowed: boolean }>(
        'select allowed from article_entitlements where user_id=$1',
        [member],
      );
      expect(entitlement.rows[0].allowed).toBe(false);
    } finally {
      await db.close();
    }
  }, 30000);

  it('atomically claims only a current paid record after the server verifies Auth email', async () => {
    const db = await newDatabase();
    try {
      await db.query(
        'insert into www_migration_baseline(table_name,expected_rows,expected_fingerprint) select table_name,row_count,fingerprint from www_migration_fingerprints()',
      );
      await recordInventory(db, []);
      await db.exec(await readFile(activation, 'utf8'));
      const emailHmac = 'c'.repeat(64);
      await db.query(
        "insert into www_pending_claims(provider_member_id,email_hmac,allowed,verified_at,valid_from,valid_until) values('paid-1',$1,true,now(),now()-interval '1 day',now()+interval '1 day')",
        [emailHmac],
      );
      const claimed = await db.query<{ www_claim_paid_membership: string }>(
        'select www_claim_paid_membership($1,$2)',
        ['verified-neon-subject', emailHmac],
      );
      const profileId = claimed.rows[0].www_claim_paid_membership;
      expect(profileId).toMatch(/^[0-9a-f-]{36}$/);
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select www_member_access('verified-neon-subject') as allowed",
          )
        ).rows[0].allowed,
      ).toBe(true);
      const retry = await db.query<{ www_claim_paid_membership: string }>(
        'select www_claim_paid_membership($1,$2)',
        ['verified-neon-subject', emailHmac],
      );
      expect(retry.rows[0].www_claim_paid_membership).toBe(profileId);
      await expect(
        db.query('select www_claim_paid_membership($1,$2)', [
          'another-neon-subject',
          emailHmac,
        ]),
      ).rejects.toThrow('claim_already_bound');
      const count = await db.query<{ count: number }>(
        "select count(*)::integer as count from article_entitlements where provider_member_id='paid-1'",
      );
      expect(count.rows[0].count).toBe(1);
      // Reconciliation may write the entitlement before it refreshes the
      // pending claim. A concurrent claim must not restore the older grant.
      await db.query(
        "update www_pending_claims set verified_at=now()-interval '1 minute' where provider_member_id='paid-1'",
      );
      await db.query(
        'update article_entitlements set allowed=false, verified_at=now() where user_id=$1',
        [profileId],
      );
      await expect(
        db.query('select www_claim_paid_membership($1,$2)', [
          'verified-neon-subject',
          emailHmac,
        ]),
      ).rejects.toThrow('claim_snapshot_superseded');
      const afterReversal = await db.query<{ allowed: boolean }>(
        'select allowed from article_entitlements where user_id=$1',
        [profileId],
      );
      expect(afterReversal.rows[0].allowed).toBe(false);
    } finally {
      await db.close();
    }
  }, 30000);

  it('activates a verified legacy pending member only after a paid claim', async () => {
    const db = await newDatabase();
    try {
      await db.query(
        "insert into profiles(id,email,name,role,status) values($1,'legacy@example.test','既存会員','member','pending')",
        [member],
      );
      await db.query(
        "insert into www_auth_links(profile_id,auth_subject,legacy_supabase_user_id,verified_at) values($1,'legacy-neon-member',$1,now())",
        [member],
      );
      await db.query(
        'insert into www_migration_baseline(table_name,expected_rows,expected_fingerprint) select table_name,row_count,fingerprint from www_migration_fingerprints()',
      );
      await recordInventory(db, []);
      await db.exec(await readFile(activation, 'utf8'));
      const emailHmac = 'd'.repeat(64);
      await db.query(
        "insert into www_pending_claims(provider_member_id,email_hmac,allowed,verified_at,valid_from,valid_until) values('paid-legacy',$1,true,now(),now()-interval '1 day',now()+interval '1 day')",
        [emailHmac],
      );
      const claimed = await db.query<{ www_claim_paid_membership: string }>(
        'select www_claim_paid_membership($1,$2)',
        ['legacy-neon-member', emailHmac],
      );
      expect(claimed.rows[0].www_claim_paid_membership).toBe(member);
      const profile = await db.query<{ status: string }>(
        'select status from profiles where id=$1',
        [member],
      );
      expect(profile.rows[0].status).toBe('active');
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select www_member_access('legacy-neon-member') as allowed",
          )
        ).rows[0].allowed,
      ).toBe(true);
    } finally {
      await db.close();
    }
  }, 30000);
});

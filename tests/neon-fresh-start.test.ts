import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const schema = new URL('../migrations/neon/0001_www_schema.sql', import.meta.url);
const freshStart = new URL('../migrations/neon/0002_fresh_start.sql', import.meta.url);
const ownerAccess = new URL('../migrations/neon/0003_owner_member_access.sql', import.meta.url);

async function newDatabase() {
  const db = new PGlite();
  await db.exec(await readFile(schema, 'utf8'));
  return db;
}

describe('fresh Neon installation after legacy project deletion', () => {
  it('opens only a genuinely empty database and does not grant unpaid access', async () => {
    const db = await newDatabase();
    try {
      await db.exec(await readFile(freshStart, 'utf8'));
      const gate = await db.query<{ active: boolean }>(
        'select activated_at is not null as active from www_migration_control',
      );
      expect(gate.rows[0].active).toBe(true);

      await db.query(
        "insert into profiles(email,name,role,status) values('owner@example.test','Owner','owner','active')",
      );
      const owner = await db.query<{ id: string }>(
        "select id from profiles where email='owner@example.test'",
      );
      await db.query(
        'insert into www_auth_links(profile_id,auth_subject,verified_at) values($1,$2,now())',
        [owner.rows[0].id, 'verified-owner-subject'],
      );
      const access = await db.query<{ allowed: boolean }>(
        "select www_member_access('verified-owner-subject') as allowed",
      );
      expect(access.rows[0].allowed).toBe(false);

      await expect(db.exec(await readFile(freshStart, 'utf8'))).rejects.toThrow(
        'backend_already_activated',
      );
      await db.exec('rollback');
    } finally {
      await db.close();
    }
  }, 30000);

  it('lets a verified owner inspect member content without recording a payment', async () => {
    const db = await newDatabase();
    try {
      await db.exec(await readFile(freshStart, 'utf8'));
      await db.exec(await readFile(ownerAccess, 'utf8'));
      await db.query(
        "insert into profiles(email,name,role,status) values('owner@example.test','Owner','owner','active'),('member@example.test','Member','member','active')",
      );
      await db.query(
        "insert into www_auth_links(profile_id,auth_subject,verified_at) select id, case role when 'owner' then 'verified-owner' else 'verified-member' end, now() from profiles",
      );
      const access = await db.query<{ owner_allowed: boolean; member_allowed: boolean; entitlements: number }>(
        "select www_member_access('verified-owner') as owner_allowed, www_member_access('verified-member') as member_allowed, (select count(*)::int from article_entitlements) as entitlements",
      );
      expect(access.rows[0]).toEqual({
        owner_allowed: true,
        member_allowed: false,
        entitlements: 0,
      });
    } finally {
      await db.close();
    }
  }, 30000);

  it('refuses to activate if any content or migration record exists', async () => {
    const db = await newDatabase();
    try {
      await db.query(
        "insert into contents(type,title,slug) values('FIELD','畑','field-draft')",
      );
      await expect(db.exec(await readFile(freshStart, 'utf8'))).rejects.toThrow(
        'fresh_start_requires_empty_database',
      );
      await db.exec('rollback');
      const gate = await db.query<{ active: boolean }>(
        'select activated_at is not null as active from www_migration_control',
      );
      expect(gate.rows[0].active).toBe(false);
    } finally {
      await db.close();
    }
  }, 30000);
});

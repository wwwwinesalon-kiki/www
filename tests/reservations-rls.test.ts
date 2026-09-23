import { beforeAll, afterAll, expect, it } from 'vitest';
import { testDatabase, asRole, ids } from './support/database.mjs';
let db: Awaited<ReturnType<typeof testDatabase>>;
let eventId: string;
beforeAll(async () => {
  db = await testDatabase();
  const result = await db.query<{id:string}>(
    "insert into events(title,slug,start_at,end_at,venue,capacity,price,publish_status,waitlist_enabled,member_only) values('Member wine','member-wine',now()+interval '1 day',now()+interval '1 day 2 hours','Yoichi',1,5000,'published',true,true) returning id",
  );
  eventId = result.rows[0].id;
},30000);
afterAll(async () => { await db?.close(); });

it('rejects public and direct member inserts', async () => {
  await expect(asRole(db,'anon','',tx => tx.query(
    "insert into event_applications(event_id,name,email) values($1,'Public','p@example.test')",[eventId],
  ))).rejects.toThrow();
  await expect(asRole(db,'authenticated',ids.member,tx => tx.query(
    "insert into event_applications(event_id,name,email) values($1,'Member','m@example.test')",[eventId],
  ))).rejects.toThrow();
});

it('accepts only paid members and serializes capacity into waitlist', async () => {
  await expect(asRole(db,'authenticated',ids.pending,tx => tx.query(
    "select * from apply_to_member_event($1,'Pending','p@example.test','','')",[eventId],
  ))).rejects.toThrow('membership_required');
  const first = await asRole(db,'authenticated',ids.member,tx => tx.query<{application_status:string}>(
    "select * from apply_to_member_event($1,'Member','m@example.test','','')",[eventId],
  ));
  expect(first.rows[0].application_status).toBe('pending');
  await expect(asRole(db,'authenticated',ids.member,tx => tx.query(
    "select * from apply_to_member_event($1,'Member','m@example.test','','')",[eventId],
  ))).rejects.toThrow('already_applied');
  await db.query("update article_entitlements set user_id=$1,provider_member_id='second' where user_id=$2",
    [ids.pending,ids.member]);
  const second = await asRole(db,'authenticated',ids.pending,tx => tx.query<{application_status:string}>(
    "select * from apply_to_member_event($1,'Second','s@example.test','','')",[eventId],
  ));
  expect(second.rows[0].application_status).toBe('waitlist');
});

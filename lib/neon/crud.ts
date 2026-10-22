import 'server-only';
import { neonSql } from './db';

export type NeonTable = 'events' | 'contents' | 'event_applications';

const identifier = /^[a-z][a-z0-9_]*$/;

function checkedColumns(payload: Record<string, unknown>, allowed: readonly string[]) {
  const keys = Object.keys(payload).filter((key) => allowed.includes(key));
  if (!keys.length || keys.some((key) => !identifier.test(key))) {
    throw new Error('No valid fields');
  }
  return keys;
}

/** Table names and allowed columns must come from code constants, never request data. */
export async function neonInsert(
  table: NeonTable,
  payload: Record<string, unknown>,
  allowed: readonly string[],
) {
  const keys = checkedColumns(payload, allowed);
  const placeholders = keys.map((_, index) => `$${index + 1}`);
  const rows = await neonSql().query(
    `insert into public.${table} (${keys.join(',')}) values (${placeholders.join(',')}) returning *, updated_at::text as updated_at_version`,
    keys.map((key) => payload[key]),
  );
  return (rows as Record<string, unknown>[])[0] ?? null;
}

export async function neonPatch(
  table: NeonTable,
  id: string,
  payload: Record<string, unknown>,
  allowed: readonly string[],
  expectedUpdatedAt?: string,
) {
  const keys = checkedColumns(payload, allowed);
  const updates = keys.map((key, index) => `${key}=$${index + 1}`);
  const values = keys.map((key) => payload[key]);
  updates.push('updated_at=now()');
  values.push(id);
  const predicate = expectedUpdatedAt
    ? ` and updated_at=$${values.length + 1}::timestamptz`
    : '';
  if (expectedUpdatedAt) values.push(expectedUpdatedAt);
  const rows = await neonSql().query(
    `update public.${table} set ${updates.join(',')} where id=$${keys.length + 1}::uuid${predicate} returning *, updated_at::text as updated_at_version`,
    values,
  );
  return (rows as Record<string, unknown>[])[0] ?? null;
}

export async function neonArchive(table: NeonTable, id: string) {
  const sql = neonSql();
  if (table === 'event_applications') {
    return sql`update public.event_applications set deleted_at=now(),updated_at=now()
      where id=${id}::uuid returning id`;
  }
  if (table === 'events') {
    return sql`update public.events set archived_at=now(),deleted_at=now(),updated_at=now()
      where id=${id}::uuid returning id`;
  }
  return sql`update public.contents set archived_at=now(),deleted_at=now(),updated_at=now()
    where id=${id}::uuid returning id`;
}

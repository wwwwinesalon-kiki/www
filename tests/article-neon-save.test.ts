import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/neon/db', () => ({
  isNeonBackend: () => true,
  neonSql: () => Object.assign(mocks.query, { query: mocks.query }),
}));
import { saveArticle } from '../lib/article-write';

const id = '11111111-1111-4111-8111-111111111111';
it('creates a draft and round-trips the exact PostgreSQL version across repeated saves', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('../migrations/neon/0001_www_schema.sql', import.meta.url), 'utf8'));
    mocks.query.mockImplementation(async (query: string | TemplateStringsArray, valuesOrFirst?: unknown, ...rest: unknown[]) => {
      const tagged = Array.isArray(query);
      const text = tagged ? query.map((part, index) => part + (index < query.length - 1 ? `$${index + 1}` : '')).join('') : query;
      const values = tagged ? [valuesOrFirst, ...rest].slice(0, query.length - 1) : valuesOrFirst;
      return (await db.query(text as string, values as unknown[])).rows;
    });
    const input = { id, title: '', type: 'FIELD', body: '<h2>今日の畑</h2><p>本文</p>', publish_status: 'draft' };
    const req = (value: object, method: string) => new Request('https://www.test/api/admin/entity/contents', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
    });
    const first = await saveArticle(req(input, 'POST'), {} as never);
    expect(first.status).toBe(201);
    let version = (await first.json()).updated_at;
    for (let i = 0; i < 2; i++) {
      const response = await saveArticle(req({ ...input, title: '保存後の畑', updated_at: version }, 'PATCH'), {} as never, id);
      expect(response.status).toBe(200);
      version = (await response.json()).updated_at;
    }
    const stale = await saveArticle(req({ ...input, updated_at: '2020-01-01T00:00:00Z' }, 'PATCH'), {} as never, id);
    expect(stale.status).toBe(409);
    const rows = await db.query<{ title: string; body: string }>('select title,body from contents where id=$1', [id]);
    expect(rows.rows[0]).toEqual({ title: '保存後の畑', body: input.body });
  } finally {
    await db.close();
  }
}, 30000);

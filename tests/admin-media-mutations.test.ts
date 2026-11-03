import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ admin: vi.fn(), sql: vi.fn(), put: vi.fn(), get: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: mocks.admin }));
vi.mock('@/lib/neon/db', () => ({ isNeonBackend: () => true, neonSql: () => mocks.sql }));
vi.mock('@/lib/neon/storage', () => ({
  articleImagePath: (article: string, media: string) => `${article}/${media}`,
  putArticleImage: mocks.put, getArticleImage: mocks.get, deleteArticleImage: mocks.remove,
}));
import { DELETE, PATCH } from '../app/api/admin/media/[id]/route';

const article = '11111111-1111-4111-8111-111111111111';
const media = '22222222-2222-4222-8222-222222222222';
const context = { params: Promise.resolve({ id: media }) };
it('preserves referenced media, swaps replacement objects, and deletes only unreferenced images', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('../migrations/neon/0001_www_schema.sql', import.meta.url), 'utf8'));
    mocks.admin.mockResolvedValue({ role: 'owner' });
    mocks.sql.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const text = parts.map((part, index) => part + (index < parts.length - 1 ? `$${index + 1}` : '')).join('');
      return (await db.query(text, values)).rows;
    });
    mocks.remove.mockResolvedValue(undefined);
    mocks.put.mockImplementation(async (_path: string, bytes: Uint8Array) => { mocks.get.mockResolvedValue(bytes); });
    await db.query("insert into contents(id,type,title,slug,cover_image) values($1,'FIELD','記事','field',$2)", [article, `/api/media/${media}`]);
    await db.query("insert into article_media(id,article_id,object_path,alt,mime_type,size_bytes) values($1,$2,'old/image','旧画像','image/png',10)", [media, article]);
    await db.query("insert into www_media_migration_status(media_id,target_object_key,sha256,verified_at) values($1,'old/image',$2,now())", [media, 'a'.repeat(64)]);
    const deletion = () => new Request('https://www.test/api/admin/media/' + media, { method: 'DELETE', body: JSON.stringify({ article_id: article }) });
    expect((await DELETE(deletion(), context)).status).toBe(409);
    expect(mocks.remove).not.toHaveBeenCalled();
    const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#8a4058' } }).png().toBuffer();
    const form = new FormData();
    form.set('article_id', article); form.set('alt', '差し替えた画像');
    form.set('file', new File([new Uint8Array(png)], 'image.png', { type: 'image/png' }));
    const replaced = await PATCH(new Request('https://www.test/api/admin/media/' + media, { method: 'PATCH', body: form }), context);
    expect(replaced.status).toBe(200);
    const rows = await db.query<{ mime_type: string; alt: string; object_path: string; verified_path: string }>('select m.mime_type,m.alt,m.object_path,v.target_object_key as verified_path from article_media m join www_media_migration_status v on v.media_id=m.id');
    expect(rows.rows[0]).toMatchObject({ mime_type: 'image/webp', alt: '差し替えた画像' });
    expect(rows.rows[0].object_path).toBe(rows.rows[0].verified_path);
    expect(rows.rows[0].object_path).not.toBe('old/image');
    expect(mocks.remove).toHaveBeenCalledWith('old/image');
    await db.query('update contents set cover_image=null where id=$1', [article]);
    expect((await DELETE(deletion(), context)).status).toBe(200);
    expect((await db.query('select * from article_media')).rows).toHaveLength(0);
    expect((await db.query('select * from www_media_migration_status')).rows).toHaveLength(0);
  } finally { await db.close(); }
}, 30000);

it('rejects unauthenticated media changes before reading data', async () => {
  mocks.admin.mockResolvedValue(null);
  const request = new Request('https://www.test/api/admin/media/' + media, { method: 'DELETE' });
  expect((await DELETE(request, context)).status).toBe(403);
});

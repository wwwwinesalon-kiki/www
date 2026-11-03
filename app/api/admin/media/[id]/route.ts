import { createHash, randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/admin-auth';
import { UUID } from '@/lib/article';
import { articleWebp } from '@/lib/article-image';
import { isNeonBackend, neonSql } from '@/lib/neon/db';
import { articleImagePath, deleteArticleImage, getArticleImage, putArticleImage } from '@/lib/neon/storage';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
type Context = { params: Promise<{ id: string }> };
type MediaRow = { id: string; article_id: string; object_path: string; alt: string };

export async function PATCH(req: Request, { params }: Context) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: '画像IDが不正です' }, { status: 422, headers });
  if (Number(req.headers.get('content-length') || 0) > 12 * 1024 * 1024 + 65536)
    return Response.json({ error: '画像は12MB以下にしてください' }, { status: 413, headers });
  let newPath: string | undefined;
  let committed = false;
  try {
    const form = await req.formData();
    const articleId = String(form.get('article_id') || '');
    const alt = String(form.get('alt') || '').trim();
    if (!UUID.test(articleId) || !alt || alt.length > 500)
      throw new Error('記事IDと画像の説明を確認してください');
    // The active deployment uses Neon. Do not silently mutate a deleted legacy store.
    if (!isNeonBackend()) return Response.json({ error: '現在の保存先では画像の変更に対応していません' }, { status: 503, headers });
    const sql = neonSql();
    const rows = await sql`select id, article_id, object_path, alt from public.article_media where id=${id}::uuid and article_id=${articleId}::uuid` as MediaRow[];
    const media = rows[0];
    if (!media) return Response.json({ error: '画像が見つかりません' }, { status: 404, headers });
    const file = form.get('file');
    if (file instanceof File && file.size) {
      const bytes = await articleWebp(file);
      // A new object key keeps the old image intact until metadata is committed.
      newPath = articleImagePath(articleId, randomUUID());
      await putArticleImage(newPath, bytes, 'image/webp');
      const copied = await getArticleImage(newPath);
      const sha = createHash('sha256').update(bytes).digest('hex');
      if (!copied || createHash('sha256').update(copied).digest('hex') !== sha)
        throw new Error('画像の検証に失敗しました');
      const changed = await sql`
        with updated as (
          update public.article_media set object_path=${newPath}, alt=${alt}, mime_type='image/webp', size_bytes=${bytes.length}
          where id=${id}::uuid and article_id=${articleId}::uuid and object_path=${media.object_path}
          returning id, object_path
        )
        insert into public.www_media_migration_status(media_id,target_object_key,sha256,verified_at)
        select id,object_path,${sha},now() from updated
        on conflict(media_id) do update set target_object_key=excluded.target_object_key, sha256=excluded.sha256, verified_at=excluded.verified_at
        returning media_id
      ` as { media_id: string }[];
      if (!changed.length) throw new Error('画像が別の画面で変更されました 一覧を読み直してください');
      committed = true;
      try { await deleteArticleImage(media.object_path); } catch { /* Old private object is no longer served. */ }
    } else {
      await sql`update public.article_media set alt=${alt} where id=${id}::uuid and article_id=${articleId}::uuid`;
    }
    return Response.json({ id, alt, url: '/api/media/' + id }, { headers });
  } catch (error) {
    if (newPath && !committed) {
      try { await deleteArticleImage(newPath); } catch { /* Unreferenced private object. */ }
    }
    return Response.json({ error: error instanceof Error ? error.message : '画像を変更できませんでした' }, { status: 422, headers });
  }
}

export async function DELETE(req: Request, { params }: Context) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  const { id } = await params;
  try {
    const input = await req.json();
    const articleId = input.article_id;
    if (!UUID.test(id) || typeof articleId !== 'string' || !UUID.test(articleId))
      throw new Error('画像IDと記事IDを確認してください');
    if (!isNeonBackend()) return Response.json({ error: '現在の保存先では画像の削除に対応していません' }, { status: 503, headers });
    const sql = neonSql();
    const media = await sql`select object_path from public.article_media where id=${id}::uuid and article_id=${articleId}::uuid` as { object_path: string }[];
    if (!media.length) return Response.json({ error: '画像が見つかりません' }, { status: 404, headers });
    // Check all saved articles, including drafts: deleting an in-use image must
    // never leave a saved article with a broken cover or body image.
    const deleted = await sql`
      delete from public.article_media m where m.id=${id}::uuid and m.article_id=${articleId}::uuid
      and not exists(select 1 from public.contents c where c.cover_image=${'/api/media/' + id} or position(${'/api/media/' + id} in c.body)>0)
      returning m.object_path
    ` as { object_path: string }[];
    if (!deleted.length) return Response.json({ error: '記事で使用中です メイン画像と本文から外して記事を保存した後に削除してください' }, { status: 409, headers });
    let cleanupPending = false;
    try { await deleteArticleImage(deleted[0].object_path); } catch { cleanupPending = true; }
    return Response.json({ ok: true, cleanup_pending: cleanupPending }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '画像を削除できませんでした' }, { status: 422, headers });
  }
}

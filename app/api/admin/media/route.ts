import { createHash } from 'node:crypto';
import { requireAdmin } from '@/lib/admin-auth';
import { UUID, MAX_IMAGE_BYTES } from '@/lib/article';
import { checkImage } from '@/lib/image-upload';
import { isNeonBackend, neonSql } from '@/lib/neon/db';
import {
  articleImagePath,
  deleteArticleImage,
  getArticleImage,
  putArticleImage,
} from '@/lib/neon/storage';

export async function GET(req: Request) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('article');
  if (!UUID.test(id || ''))
    return Response.json({ error: '記事IDが必要です' }, { status: 422 });
  if (isNeonBackend()) {
    try {
      const rows = await neonSql()`
        select id, alt from article_media
        where article_id = ${id}::uuid
        order by created_at desc
      `;
      return Response.json(rows, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    } catch {
      return Response.json(
        { error: '画像一覧を取得できません 保存先の設定を確認してください' },
        { status: 503 },
      );
    }
  }
  const { data, error } = await actor.supabase
    .from('article_media')
    .select('id,alt')
    .eq('article_id', id)
    .order('created_at', { ascending: false });
  return error
    ? Response.json(
        { error: '画像一覧を取得できません Storage設定を確認してください' },
        { status: 503 },
      )
    : Response.json(data, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
}
export async function POST(req: Request) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  if (!isNeonBackend() && !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return Response.json(
      { error: '画像配信のサーバー設定が未完了です' },
      { status: 503 },
    );
  if (Number(req.headers.get('content-length') || 0) > MAX_IMAGE_BYTES + 65536)
    return Response.json(
      { error: '画像は3MB以下にしてください' },
      { status: 413 },
    );
  try {
    const form = await req.formData();
    const file = form.get('file');
    const articleField = form.get('article_id');
    const altField = form.get('alt');
    const articleId = typeof articleField === 'string' ? articleField : '';
    const alt = typeof altField === 'string' ? altField.trim() : '';
    if (
      !(file instanceof File) ||
      !UUID.test(articleId) ||
      !alt ||
      alt.length > 500 ||
      file.size > MAX_IMAGE_BYTES
    )
      throw new Error('画像・記事ID・画像の説明を確認してください 最大3MBです');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!checkImage(bytes, file.type))
      throw new Error('JPEG PNG WebPの画像を選択してください');
    const id = crypto.randomUUID();
    const objectPath = articleImagePath(articleId, id);
    if (isNeonBackend()) {
      let uploaded = false;
      try {
        await putArticleImage(objectPath, bytes, file.type);
        uploaded = true;
        const copiedBytes = await getArticleImage(objectPath);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (
          !copiedBytes ||
          createHash('sha256').update(copiedBytes).digest('hex') !== sha256
        )
          throw new Error('画像の検証に失敗しました');
        try {
          await neonSql()`
            with inserted as (
              insert into article_media
                (id, article_id, object_path, alt, mime_type, size_bytes)
              values
                (${id}::uuid, ${articleId}::uuid, ${objectPath}, ${alt},
                  ${file.type}, ${file.size})
              returning id, object_path
            )
            insert into www_media_migration_status
              (media_id, target_object_key, sha256, verified_at)
            select id, object_path, ${sha256}, now() from inserted
          `;
        } catch {
          try {
            await deleteArticleImage(objectPath);
          } catch {
            return Response.json(
              {
                error:
                  '画像の登録に失敗しました 保存先ID ' +
                  objectPath +
                  ' を管理者へお知らせください',
              },
              { status: 503 },
            );
          }
          return Response.json(
            { error: '画像の登録に失敗しました 原稿は保持されています' },
            { status: 503 },
          );
        }
      } catch {
        if (uploaded) {
          try {
            await deleteArticleImage(objectPath);
          } catch {
            return Response.json(
              {
                error:
                  '画像の検証に失敗しました 保存先ID ' +
                  objectPath +
                  ' を管理者へお知らせください',
              },
              { status: 503 },
            );
          }
        }
        return Response.json(
          {
            error:
              '画像を保存できませんでした Neonの非公開Storage設定を確認してください',
          },
          { status: 503 },
        );
      }
      return Response.json(
        { id, alt, url: '/api/media/' + id },
        { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    const { error: uploadError } = await actor.supabase.storage
      .from('www-article-images')
      .upload(objectPath, bytes, { contentType: file.type, upsert: false });
    if (uploadError)
      throw new Error(
        '画像を保存できませんでした Storage設定を確認して再試行してください',
      );
    const { error } = await actor.supabase.from('article_media').insert({
      id,
      article_id: articleId,
      object_path: objectPath,
      alt,
      mime_type: file.type,
      size_bytes: file.size,
    });
    if (error)
      throw new Error(
        '画像の登録に失敗しました 原稿は保持されています 管理者へ保存先ID ' +
          objectPath +
          ' をお知らせください',
      );
    return Response.json(
      { id, alt, url: '/api/media/' + id },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : '画像の保存に失敗しました',
      },
      { status: 422 },
    );
  }
}

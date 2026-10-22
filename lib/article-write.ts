import { articlePayload, UUID } from '@/lib/article';
import type { requireAdmin } from '@/lib/admin-auth';
import { isNeonBackend, neonSql } from '@/lib/neon/db';
import { neonInsert, neonPatch } from '@/lib/neon/crud';
type Actor = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>;
const articleFields = [
  'id', 'slug', 'type', 'title', 'summary', 'body', 'body_format',
  'cover_image', 'cover_alt', 'publish_status', 'published_at',
  'member_visible', 'public_visible',
] as const;

async function saveNeonArticle(input: Record<string, unknown>, id?: string) {
  const articleId = id || input.id;
  if (typeof articleId !== 'string' || !UUID.test(articleId))
    throw new Error('記事IDが不正です');
  let existing: Record<string, unknown> | undefined;
  if (id) {
    const rows = await neonSql()`select * from public.contents
      where id=${id}::uuid and deleted_at is null limit 1`;
    existing = (rows as Record<string, unknown>[])[0];
    if (!existing) return Response.json({ error: '記事が見つかりません' }, { status: 404 });
    // PostgreSQL timestamps retain microseconds; the JS Date parser does not.
    // Compare the exact database text version in the UPDATE predicate below.
    if (typeof input.updated_at !== 'string' || !input.updated_at)
      return Response.json({ error: '更新日時がありません 再読み込みしてください' }, { status: 409 });
  }
  const payload = articlePayload(input, existing);
  const references = Array.from(new Set(
    (payload.body + ' ' + (payload.cover_image || '')).match(/\/api\/media\/[a-f0-9-]{36}/gi) || [],
  )).map((url) => url.split('/').pop()!);
  if (references.length) {
    const media = await neonSql()`select id from public.article_media
      where article_id=${articleId}::uuid`;
    const allowed = new Set((media as { id: string }[]).map((row) => row.id));
    if (references.some((reference) => !allowed.has(reference)))
      throw new Error('この記事にアップロードした画像を選択してください');
    if (existing?.public_visible && payload.publish_status === 'published')
      throw new Error('一般公開記事には非公開画像を使えません 既存の公開画像を保持してください');
  }
  const row = id
    ? await neonPatch('contents', id, payload, articleFields, String(input.updated_at))
    : await neonInsert('contents', {
        ...payload, id: articleId, slug: articleId,
        member_visible: true, public_visible: false,
      }, articleFields);
  if (!row)
    return Response.json({ error: '更新が競合しました 原稿をコピーしてから再読み込みしてください' }, { status: 409 });
  return Response.json({ id: row.id, updated_at: row.updated_at_version }, {
    status: id ? 200 : 201,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function saveArticle(req: Request, actor: Actor, id?: string) {
  try {
    if (Number(req.headers.get('content-length') || 0) > 300000)
      return Response.json({ error: '本文が大きすぎます' }, { status: 413 });
    const input = await req.json();
    if (isNeonBackend()) return await saveNeonArticle(input, id);
    const articleId = id || input.id;
    if (!UUID.test(articleId || '')) throw new Error('記事IDが不正です');
    let existing: Record<string, unknown> | undefined;
    if (id) {
      const { data, error } = await actor.supabase
        .from('contents')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      if (error || !data)
        return Response.json(
          { error: '記事が見つかりません' },
          { status: 404 },
        );
      existing = data;
      if (input.updated_at !== data.updated_at)
        return Response.json(
          {
            error:
              '他の画面で更新されています 原稿をコピーしてから再読み込みしてください',
          },
          { status: 409 },
        );
    }
    const payload = articlePayload(input, existing);
    const references = Array.from(
      new Set(
        (payload.body + ' ' + (payload.cover_image || '')).match(
          /\/api\/media\/[a-f0-9-]{36}/gi,
        ) || [],
      ),
    ).map((url) => url.split('/').pop()!);
    if (references.length) {
      const { data, error } = await actor.supabase
        .from('article_media')
        .select('id')
        .eq('article_id', articleId)
        .in('id', references);
      if (error || data?.length !== references.length)
        throw new Error('この記事にアップロードした画像を選択してください');
      if (existing?.public_visible && payload.publish_status === 'published')
        throw new Error(
          '一般公開記事には非公開画像を使えません 既存の公開画像を保持してください',
        );
    }
    const now = new Date().toISOString();
    const result = id
      ? await actor.supabase
          .from('contents')
          .update({ ...payload, updated_at: now })
          .eq('id', id)
          .eq('updated_at', input.updated_at)
          .select('id,updated_at')
          .maybeSingle()
      : await actor.supabase
          .from('contents')
          .insert({
            ...payload,
            id: articleId,
            slug: articleId,
            member_visible: true,
            public_visible: false,
            updated_at: now,
          })
          .select('id,updated_at')
          .single();
    if (result.error)
      return Response.json(
        {
          error:
            '保存できませんでした 原稿を保持しています 設定または重複を確認して再試行してください',
        },
        { status: 422 },
      );
    if (!result.data)
      return Response.json(
        {
          error:
            '更新が競合しました 原稿をコピーしてから再読み込みしてください',
        },
        { status: 409 },
      );
    return Response.json(result.data, {
      status: id ? 200 : 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : '入力を確認してください',
      },
      { status: 422 },
    );
  }
}

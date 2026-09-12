import { articlePayload, UUID } from '@/lib/article';
import type { requireAdmin } from '@/lib/admin-auth';
type Actor = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>;
export async function saveArticle(req: Request, actor: Actor, id?: string) {
  try {
    if (Number(req.headers.get('content-length') || 0) > 300000)
      return Response.json({ error: '本文が大きすぎます' }, { status: 413 });
    const input = await req.json();
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
      if (existing?.public_visible)
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

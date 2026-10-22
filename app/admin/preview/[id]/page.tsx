import { notFound } from 'next/navigation';
import Image from 'next/image';
import ArticleBody from '@/components/article-body';
import { memberAccess } from '@/lib/member-access';
import { isNeonBackend, neonSql } from '@/lib/neon/db';
import { UUID } from '@/lib/article';
export const dynamic = 'force-dynamic';
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await memberAccess();
  if (!access.editor) notFound();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data: c, error } = isNeonBackend()
    ? { data: ((await neonSql()`select * from public.contents
        where id=${id}::uuid and deleted_at is null limit 1`) as unknown as Record<string, string>[])[0],
        error: null }
    : await access.supabase
        .from('contents')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
  if (error || !c) notFound();
  return (
    <article className="article-shell">
      <p className="article-notice">
        管理者プレビュー ·{' '}
        {c.publish_status === 'published' ? '公開中' : '下書き'} ·
        会員への表示とは異なります
      </p>
      <a href={'/admin/contents/' + id}>編集へ戻る</a>
      <p>{c.type}</p>
      <h1>{c.title}</h1>
      {c.cover_image && (
        <Image
          unoptimized
          className="article-cover"
          src={c.cover_image}
          alt={c.cover_alt || c.title}
          width={1200}
          height={800}
        />
      )}
      <ArticleBody body={c.body} format={c.body_format} />
    </article>
  );
}

import { memberAccess } from '@/lib/member-access';
import { storageService } from '@/lib/supabase/service';
import { UUID } from '@/lib/article';
import { isNeonBackend, neonSql } from '@/lib/neon/db';
import { getArticleImage } from '@/lib/neon/storage';
import { ARTICLE_MEDIA_ACCESS_SQL } from '@/lib/neon/media-access';
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await memberAccess();
  const headers = {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!UUID.test(id) || !access.user || (!access.editor && !access.entitled))
    return new Response(null, { status: 404, headers });
  if (isNeonBackend()) {
    try {
      const media = (await neonSql().query(ARTICLE_MEDIA_ACCESS_SQL, [
        id,
        access.editor,
        access.entitled,
      ])) as Array<{ object_path: string; mime_type: string }>;
      if (!media[0]) return new Response(null, { status: 404, headers });
      const bytes = await getArticleImage(media[0].object_path);
      if (!bytes) return new Response(null, { status: 404, headers });
      const body = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(body).set(bytes);
      return new Response(body, {
        headers: {
          ...headers,
          'Content-Type': media[0].mime_type,
          'Content-Disposition': 'inline',
        },
      });
    } catch {
      return new Response(null, { status: 503, headers });
    }
  }
  const { data, error } = await access.supabase
    .from('article_media')
    .select('object_path,mime_type')
    .eq('id', id)
    .single();
  if (error || !data) return new Response(null, { status: 404, headers });
  try {
    const { data: blob, error: downloadError } = await storageService()
      .storage.from('www-article-images')
      .download(data.object_path);
    if (downloadError || !blob)
      return new Response(null, { status: 404, headers });
    return new Response(blob, {
      headers: {
        ...headers,
        'Content-Type': data.mime_type,
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}

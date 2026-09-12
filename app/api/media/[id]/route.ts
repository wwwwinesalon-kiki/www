import { memberAccess } from '@/lib/member-access';
import { storageService } from '@/lib/supabase/service';
import { UUID } from '@/lib/article';
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

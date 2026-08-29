import { env } from 'cloudflare:workers';
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params,
    row = await env.DB.prepare(
      'SELECT r2_key,mime_type FROM content_media WHERE id=?',
    )
      .bind(id)
      .first<{ r2_key: string; mime_type: string }>();
  if (!row) return new Response('Not found', { status: 404 });
  const object = await env.FILES.get(row.r2_key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'content-type': row.mime_type,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

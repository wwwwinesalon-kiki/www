import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
const allowed = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
]);
export async function POST(req: Request) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const form = await req.formData(),
    file = form.get('file'),
    contentValue = form.get('contentId'),
    contentId = typeof contentValue === 'string' ? contentValue : '';
  if (!(file instanceof File) || !contentId)
    return Response.json(
      { error: 'File and Content are required' },
      { status: 422 },
    );
  if (!allowed.has(file.type) || file.size > 25 * 1024 * 1024)
    return Response.json(
      { error: 'JPG/PNG/WebP/MP3/M4A、25MB以下にしてください' },
      { status: 422 },
    );
  const exists = await env.DB.prepare(
    'SELECT id FROM contents WHERE id=? AND deleted_at IS NULL',
  )
    .bind(contentId)
    .first();
  if (!exists)
    return Response.json({ error: 'Content not found' }, { status: 404 });
  const id = crypto.randomUUID(),
    key = `media/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
    url = `/api/media/${id}`,
    now = new Date().toISOString();
  await env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  const field = file.type.startsWith('image/') ? 'cover_image' : 'audio';
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO content_media (id,content_id,r2_key,mime_type,size,alt,created_at) VALUES (?,?,?,?,?,?,?)',
    ).bind(
      id,
      contentId,
      key,
      file.type,
      file.size,
      form.get('alt') || null,
      now,
    ),
    env.DB.prepare(
      `UPDATE contents SET ${field}=?,updated_at=? WHERE id=?`,
    ).bind(url, now, contentId),
    env.DB.prepare(
      'INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,before,after,created_at) VALUES (?,?,?,?,?,?,?,?)',
    ).bind(
      crypto.randomUUID(),
      actor.email,
      'media.uploaded',
      'content',
      contentId,
      null,
      JSON.stringify({ id, field }),
      now,
    ),
  ]);
  return Response.json({ id, key, url, field }, { status: 201 });
}

import { env } from 'cloudflare:workers';
import type { AdminRole } from './auth';
export async function requireAdmin(req: Request, write = false) {
  if (write) {
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).origin !== new URL(req.url).origin)
      return null;
  }
  const email =
    req.headers.get('cf-access-authenticated-user-email') ||
    req.headers.get('oai-authenticated-user-email') ||
    (process.env.NODE_ENV !== 'production' ? 'owner@local.test' : '');
  if (!email) return null;
  const row = await env.DB.prepare(
    'SELECT role FROM admin_users WHERE access_email=?',
  )
    .bind(email)
    .first<{ role: AdminRole }>();
  const role =
    row?.role || (process.env.NODE_ENV !== 'production' ? 'owner' : null);
  if (!role || (write && role === 'viewer')) return null;
  return { email, role };
}

import { memberAccess } from '@/lib/member-access';
import { visibleContents } from '@/lib/data';
export async function GET() {
  const access = await memberAccess();
  if (!access.user || !access.entitled)
    return Response.json(
      { error: 'Forbidden' },
      {
        status: access.user ? 403 : 401,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  return Response.json(await visibleContents(true), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

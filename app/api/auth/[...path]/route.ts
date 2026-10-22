import { getNeonAuth } from '@/lib/neon/auth';
import { isNeonBackend } from '@/lib/neon/db';

export const dynamic = 'force-dynamic';

type AuthRouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: AuthRouteContext) {
  if (!isNeonBackend()) return new Response(null, { status: 404 });
  return getNeonAuth().handler().GET(request, context);
}

export async function POST(request: Request, context: AuthRouteContext) {
  if (!isNeonBackend()) return new Response(null, { status: 404 });
  return getNeonAuth().handler().POST(request, context);
}

export async function PUT(request: Request, context: AuthRouteContext) {
  if (!isNeonBackend()) return new Response(null, { status: 404 });
  return getNeonAuth().handler().PUT(request, context);
}

export async function PATCH(request: Request, context: AuthRouteContext) {
  if (!isNeonBackend()) return new Response(null, { status: 404 });
  return getNeonAuth().handler().PATCH(request, context);
}

export async function DELETE(request: Request, context: AuthRouteContext) {
  if (!isNeonBackend()) return new Response(null, { status: 404 });
  return getNeonAuth().handler().DELETE(request, context);
}

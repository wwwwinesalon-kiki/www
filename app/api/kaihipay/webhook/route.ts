export async function POST() {
  return Response.json(
    { error: 'SUPABASE_SERVICE_ROLE_KEYと会費ペイのWebhook情報が必要です' },
    { status: 503 },
  );
}

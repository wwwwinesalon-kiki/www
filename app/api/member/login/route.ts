export async function POST() {
  return Response.json(
    { error: 'Supabase Authを使用してください' },
    { status: 410 },
  );
}

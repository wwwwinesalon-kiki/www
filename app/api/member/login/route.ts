export async function POST() {
  return Response.json(
    { error: '会員ログイン画面からお進みください' },
    { status: 410 },
  );
}

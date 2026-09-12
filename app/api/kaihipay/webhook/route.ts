export async function POST() {
  return Response.json(
    {
      error:
        '会費ペイの認証方式・契約条件・API仕様の確認前のため連携は未設定です',
    },
    { status: 503 },
  );
}

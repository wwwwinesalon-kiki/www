import { activateFromKaihipay } from '@/lib/kaihipay-activation';

export const runtime = 'nodejs';
export const maxDuration = 60;
const noStore = { 'Cache-Control':'private, no-store' };

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({error:'Unauthorized'}, {status:401,headers:noStore});
  try {
    const result = await activateFromKaihipay();
    return Response.json(result,{headers:noStore});
  } catch {
    return Response.json({error:'同期に失敗しました 設定と実行ログを確認してください'},
      {status:503,headers:noStore});
  }
}

export const GET = run;
export const POST = run;

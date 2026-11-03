import { requireAdmin } from '@/lib/admin-auth';
import { activateFromKaihipay } from '@/lib/kaihipay-activation';
import { sameAppOrigin } from '@/lib/request-origin';

export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(req:Request) {
  const actor=await requireAdmin(req,true);
  if (!actor || actor.role!=='owner')
    return Response.json({error:'Forbidden'},{status:403,headers});
  if (!sameAppOrigin(req)) {
    return Response.json({error:'Forbidden'},{status:403,headers});
  }
  try {
    return Response.json(await activateFromKaihipay(),{headers});
  } catch {
    return Response.json({error:'同期に失敗しました 本番環境の設定と実行ログを確認してください'},
      {status:503,headers});
  }
}

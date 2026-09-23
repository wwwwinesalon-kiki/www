import { requireAdmin } from '@/lib/admin-auth';
import { activateFromKaihipay } from '@/lib/kaihipay-activation';

export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(req:Request) {
  const actor=await requireAdmin(req,true);
  if (!actor || actor.role!=='owner')
    return Response.json({error:'Forbidden'},{status:403,headers});
  try {
    if (new URL(req.headers.get('origin') || '').origin !==
        new URL(process.env.NEXT_PUBLIC_SITE_URL || req.url).origin)
      return Response.json({error:'Forbidden'},{status:403,headers});
  } catch {
    return Response.json({error:'Forbidden'},{status:403,headers});
  }
  try {
    return Response.json(await activateFromKaihipay(),{headers});
  } catch {
    return Response.json({error:'同期に失敗しました 本番環境の設定と実行ログを確認してください'},
      {status:503,headers});
  }
}

import { activateNeonFromKaihipay } from '../../lib/neon/kaihipay-runtime';

/** Runs the paid-member sync inside the long-lived background function. */
export default async function runKaihipaySync(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || process.env.BACKEND_PROVIDER !== 'neon') {
    throw new Error('Kaihipay background sync is not configured');
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }
  const result = await activateNeonFromKaihipay();
  console.info('Kaihipay reconciliation completed', result);
  return new Response(null, { status: 204 });
}

export const config = { background: true };

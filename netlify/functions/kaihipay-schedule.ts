/** Netlify production scheduler; the potentially long sync runs in background. */
export default async function scheduleKaihipaySync() {
  const secret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL;
  if (!secret || !siteUrl || new URL(siteUrl).protocol !== 'https:') {
    throw new Error('Kaihipay scheduler is not configured');
  }
  const response = await fetch(new URL('/.netlify/functions/kaihipay-background', siteUrl), {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) throw new Error('Kaihipay background dispatch failed');
}

export const config = { schedule: '0 3 * * *' };
